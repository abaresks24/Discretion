// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20ToERC7984Wrapper} from "@iexec-nox/nox-confidential-contracts/contracts/interfaces/IERC20ToERC7984Wrapper.sol";
import {IERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/interfaces/IERC7984.sol";
import {Nox} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {euint256} from "encrypted-types/EncryptedTypes.sol";

/// @title UnwrapQueue
/// @notice Symmetric counterpart of `WrapQueue` — soft-mixer for confidential
///         → plaintext exits. Users send cTokens into the queue with their
///         intended plaintext destination; an authorized operator (iExec TDX
///         iApp in production) batches multiple exits, performs a single
///         `wrapper.unwrap(...)` for the aggregate, awaits the gateway
///         decryption, then redistributes the plaintext to the destinations.
///
/// @dev    Privacy model — same as `WrapQueue` but in reverse:
///           - 1:1 timing correlation between the user's `queueUnwrap` and
///             the resulting plaintext credit at their destination is broken
///           - 1:1 ordering between queue entries and outgoing transfers is
///             broken (operator picks batch composition + order)
///
///         What is NOT hidden:
///           - The amount each user queued (plaintext in the `Queued` event,
///             same trade-off as `WrapQueue`)
///           - That a user participated in the queue
///
///         The operator role is intentionally monolithic for the hackathon —
///         production replaces it with the TDX iApp so that nobody, not
///         even the deployer, can correlate exits with destinations.
contract UnwrapQueue {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlying;
    IERC20ToERC7984Wrapper public immutable wrapper; // also implements IERC7984
    address public owner;
    address public operator;

    struct Entry {
        address depositor;
        address destination;
        uint256 amount;        // plaintext (revealed in event, same as WrapQueue)
        uint40 queuedAt;
        bool processed;
    }

    Entry[] private _queue;
    /// @dev mapping from the wrapper's unwrap-request handle to the batch ids.
    mapping(bytes32 => uint256[]) private _pendingBatches;

    event Queued(uint256 indexed id, address indexed depositor, uint256 amount);
    event BatchSubmitted(bytes32 indexed reqHandle, uint256 count);
    event BatchProcessed(bytes32 indexed reqHandle, uint256 count);
    event EmergencyReclaim(uint256 indexed id, address indexed depositor, uint256 amount);
    event OperatorChanged(address indexed operator);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotOwner();
    error NotOperator();
    error ZeroAmount();
    error AlreadyProcessed();
    error NotDepositor();
    error UnknownBatch(bytes32 reqHandle);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor(address _underlying, address _wrapper, address _operator) {
        underlying = IERC20(_underlying);
        wrapper = IERC20ToERC7984Wrapper(_wrapper);
        owner = msg.sender;
        operator = _operator == address(0) ? msg.sender : _operator;
        emit OwnershipTransferred(address(0), msg.sender);
        emit OperatorChanged(operator);
    }

    // -------------------------------------------------------------------------
    // User entry point
    // -------------------------------------------------------------------------

    /// @notice Queue an exit of `amount` cTokens, plaintext to land at
    ///         `destination` after the next batch+gateway round trip.
    ///         The caller must have set this contract as operator on the
    ///         cToken (`setOperator(unwrapQueue, until)`) before calling.
    /// @param  amount       plaintext amount of cTokens to unwrap
    /// @param  destination  where the resulting plaintext ERC-20 lands
    function queueUnwrap(uint256 amount, address destination) external returns (uint256 id) {
        if (amount == 0) revert ZeroAmount();
        // Pull cTokens via the trivially-encrypted overload — same plaintext
        // amount that `WrapQueue.queueWrap` records, so the privacy posture
        // is symmetric.
        euint256 enc = Nox.toEuint256(amount);
        IERC7984(address(wrapper)).confidentialTransferFrom(
            msg.sender,
            address(this),
            enc
        );
        id = _queue.length;
        _queue.push(Entry({
            depositor: msg.sender,
            destination: destination == address(0) ? msg.sender : destination,
            amount: amount,
            queuedAt: uint40(block.timestamp),
            processed: false
        }));
        emit Queued(id, msg.sender, amount);
    }

    /// @notice Reclaim a queued entry before processing (sends cTokens back).
    function reclaim(uint256 id) external {
        Entry storage e = _queue[id];
        if (e.processed) revert AlreadyProcessed();
        if (e.depositor != msg.sender) revert NotDepositor();
        e.processed = true;
        // Send the cTokens back to depositor as a confidential transfer.
        euint256 enc = Nox.toEuint256(e.amount);
        IERC7984(address(wrapper)).confidentialTransfer(e.depositor, enc);
        emit EmergencyReclaim(id, e.depositor, e.amount);
    }

    // -------------------------------------------------------------------------
    // Operator: batched exit (two-phase, gated by gateway decryption)
    // -------------------------------------------------------------------------

    /// @notice Phase 1: aggregate the listed entries into a single
    ///         `wrapper.unwrap(self, self, total)` and record the resulting
    ///         request handle so phase 2 can finalize.
    function processBatch(uint256[] calldata ids)
        external
        onlyOperator
        returns (bytes32 reqHandle)
    {
        if (ids.length == 0) revert ZeroAmount();
        uint256 total;
        for (uint256 i = 0; i < ids.length; i++) {
            Entry storage e = _queue[ids[i]];
            if (e.processed) revert AlreadyProcessed();
            total += e.amount;
        }
        // Burn `total` cTokens from this contract; the wrapper records an
        // unwrap request handle that the gateway will publicly decrypt.
        euint256 totalEnc = Nox.toEuint256(total);
        euint256 reqId = wrapper.unwrap(address(this), address(this), totalEnc);
        reqHandle = euint256.unwrap(reqId);
        _pendingBatches[reqHandle] = ids;
        emit BatchSubmitted(reqHandle, ids.length);
    }

    /// @notice Phase 2: finalise the gateway-decrypted batch and fan the
    ///         plaintext out to destinations. Called by the operator once
    ///         the gateway has produced a `decryptedAmountAndProof` for the
    ///         unwrap-request handle returned by `processBatch`.
    function finalizeBatch(
        bytes32 reqHandle,
        bytes calldata decryptedAmountAndProof
    ) external onlyOperator {
        uint256[] storage ids = _pendingBatches[reqHandle];
        if (ids.length == 0) revert UnknownBatch(reqHandle);

        // Step a — trigger the wrapper's finalize. Plaintext lands here
        //          (the `to` field on the unwrap call was `address(this)`).
        wrapper.finalizeUnwrap(euint256.wrap(reqHandle), decryptedAmountAndProof);

        // Step b — fan out plaintext to recipients.
        uint256 n = ids.length;
        for (uint256 i = 0; i < n; i++) {
            Entry storage e = _queue[ids[i]];
            underlying.safeTransfer(e.destination, e.amount);
            e.processed = true;
        }
        emit BatchProcessed(reqHandle, n);
        delete _pendingBatches[reqHandle];
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function queueLength() external view returns (uint256) {
        return _queue.length;
    }

    function entry(uint256 id) external view returns (Entry memory) {
        return _queue[id];
    }

    function pendingIds(uint256 cursor, uint256 limit) external view returns (uint256[] memory) {
        uint256 len = _queue.length;
        uint256[] memory buf = new uint256[](limit);
        uint256 n;
        for (uint256 i = cursor; i < len && n < limit; i++) {
            if (!_queue[i].processed) {
                buf[n++] = i;
            }
        }
        assembly {
            mstore(buf, n)
        }
        return buf;
    }

    /// @notice ids of a still-pending batch (between `processBatch` and
    ///         `finalizeBatch`). Useful for debugging/UI.
    function batchIds(bytes32 reqHandle) external view returns (uint256[] memory) {
        return _pendingBatches[reqHandle];
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setOperator(address newOperator) external onlyOwner {
        operator = newOperator;
        emit OperatorChanged(newOperator);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        address old = owner;
        owner = newOwner;
        emit OwnershipTransferred(old, newOwner);
    }
}
