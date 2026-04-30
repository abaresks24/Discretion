// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20ToERC7984Wrapper} from "@iexec-nox/nox-confidential-contracts/contracts/interfaces/IERC20ToERC7984Wrapper.sol";
import {IERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/interfaces/IERC7984.sol";
import {Nox} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {euint256} from "encrypted-types/EncryptedTypes.sol";

/// @title WrapQueue
/// @notice Soft-mixer for plaintext → confidential-token conversions. Users
///         drop their plaintext ERC-20 into the queue; an authorized operator
///         wraps entries in batches and redistributes the resulting cTokens
///         to recorded destinations in whatever order it pleases.
///
/// @dev    Privacy model — this is **not** a ZK mixer. It breaks:
///           - 1:1 timing correlation between user's `queueWrap` and the
///             resulting cToken credit at their destination (the batch can
///             arrive minutes later)
///           - 1:1 ordering between queue entries and outgoing transfers
///             (operator picks batch order)
///
///         It does NOT hide:
///           - The amount a user queued (plaintext in the `Queued` event)
///           - That a user participated in the queue
///
///         For true amount privacy, pair this with Nox's ERC-7984 semantics
///         at the vault boundary (which already hide per-user balances).
///
///         The operator role is intentionally monolithic for the hackathon —
///         production would replace it with an iExec TEE runner so that
///         nobody, not even the vault operator, can correlate deposits with
///         destinations off-chain.
contract WrapQueue {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlying;
    IERC20ToERC7984Wrapper public immutable wrapper;
    address public owner;
    address public operator;

    struct Entry {
        address depositor;
        address destination;
        uint256 amount;
        uint40 queuedAt;
        bool processed;
    }

    Entry[] private _queue;

    event Queued(uint256 indexed id, address indexed depositor, uint256 amount);
    event BatchProcessed(uint256 count);
    event EmergencyReclaim(uint256 indexed id, address indexed depositor, uint256 amount);
    event OperatorChanged(address indexed operator);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotOwner();
    error NotOperator();
    error ZeroAmount();
    error AlreadyProcessed();
    error NotDepositor();

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

    /// @notice Queue `amount` of the underlying ERC-20 for batched wrapping.
    ///         The caller must have approved this contract for `amount` first.
    /// @param  destination where the resulting cTokens will land after batch
    function queueWrap(uint256 amount, address destination) external returns (uint256 id) {
        if (amount == 0) revert ZeroAmount();
        underlying.safeTransferFrom(msg.sender, address(this), amount);
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

    /// @notice Reclaim a queued entry before processing. Lets users cancel
    ///         if the operator is unresponsive or the queue is stuck.
    function reclaim(uint256 id) external {
        Entry storage e = _queue[id];
        if (e.processed) revert AlreadyProcessed();
        if (e.depositor != msg.sender) revert NotDepositor();
        e.processed = true;
        underlying.safeTransfer(e.depositor, e.amount);
        emit EmergencyReclaim(id, e.depositor, e.amount);
    }

    // -------------------------------------------------------------------------
    // Operator: batch processor
    // -------------------------------------------------------------------------

    /// @notice Process a batch of queued entries — the operator passes in
    ///         the ids to include (allows them to shuffle / skip reclaimed
    ///         entries). Wraps the aggregate in one `wrap(self, total)`,
    ///         then emits `confidentialTransfer` to each destination with a
    ///         trivially-encrypted amount.
    function processBatch(uint256[] calldata ids) external onlyOperator {
        if (ids.length == 0) revert ZeroAmount();

        uint256 total;
        for (uint256 i = 0; i < ids.length; i++) {
            Entry storage e = _queue[ids[i]];
            if (e.processed) revert AlreadyProcessed();
            total += e.amount;
        }

        // Single wrap for the whole batch — cTokens arrive in this contract.
        underlying.forceApprove(address(wrapper), total);
        wrapper.wrap(address(this), total);

        // Fan out to each destination. We wrap the plaintext amount as a
        // trivial Nox handle — everyone can derive the value, but the
        // cToken's own confidentialTransfer preserves handle semantics for
        // downstream composability (the recipient gets an `euint256` they
        // can use in further operations).
        for (uint256 i = 0; i < ids.length; i++) {
            Entry storage e = _queue[ids[i]];
            euint256 enc = Nox.toEuint256(e.amount);
            IERC7984(address(wrapper)).confidentialTransfer(e.destination, enc);
            e.processed = true;
        }
        emit BatchProcessed(ids.length);
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

    /// @notice Helper for operators / relayers: list up to `limit` next
    ///         unprocessed entry ids starting from `cursor`.
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
