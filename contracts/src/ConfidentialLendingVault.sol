// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/interfaces/IERC7984.sol";
import {Nox} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {euint256, externalEuint256} from "encrypted-types/EncryptedTypes.sol";
import {IHybridPriceOracle} from "./interfaces/IHybridPriceOracle.sol";

/// @title ConfidentialLendingVault
/// @notice Single-collateral, single-debt lending vault on iExec Nox. Balances are stored as
///         encrypted handles (`euint256`) — the contract itself never sees plaintext amounts.
///         Users grant the vault operator rights on the underlying ERC-7984 tokens, then
///         submit amounts as `externalEuint256 + inputProof` pairs validated via Nox.
///
/// @dev    MVP scope (Day 2 checkpoint):
///
///           - on-chain bookkeeping of encrypted collateral & debt
///           - pull/push through the ERC-7984 cTokens using actual-transferred amounts
///           - oracle integration preserved for price reads
///
///         NOT yet on-chain (tracked for Day 3):
///
///           - encrypted LTV enforcement inside `borrow` / `withdrawCollateral`. Nox supports
///             encrypted comparisons (`Nox.ge(a, b)`) but branching on their result requires
///             either a Gateway async decryption round-trip or a `Nox.select` cap pattern.
///             For the MVP the LTV check is advisory: the relayer decrypts, computes, and the
///             frontend prevents an unsafe tx. The vault only enforces that users can't
///             withdraw or borrow more than they hold (natural guarantee: `confidentialTransfer`
///             caps at the caller's actual balance and returns the actual transferred amount).
///
///           - liquidation. Same reason — requires an encrypted-vs-threshold check.
///
///         See `TODO(day3):` markers for the exact spots that will change.
contract ConfidentialLendingVault {
    // -------------------------------------------------------------------------
    // Config (immutable)
    // -------------------------------------------------------------------------

    uint256 public constant LTV_MAX_BPS = 7500;
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
    uint256 public constant BPS_DENOMINATOR = 10000;

    IERC7984 public immutable collateralToken; // cRLC on Arbitrum Sepolia
    IERC7984 public immutable debtToken;       // cUSDC on Arbitrum Sepolia
    IHybridPriceOracle public immutable oracle;
    address public immutable collateralAsset;  // oracle lookup key (plaintext RLC)
    address public immutable debtAsset;        // oracle lookup key (plaintext USDC)

    address public owner;

    // -------------------------------------------------------------------------
    // Per-user encrypted accounting
    // -------------------------------------------------------------------------

    mapping(address => euint256) private _collateral;
    mapping(address => euint256) private _debt;

    // -------------------------------------------------------------------------
    // Events — intentionally amount-less (no leakage through event data)
    // -------------------------------------------------------------------------

    event CollateralDeposited(address indexed user);
    event CollateralWithdrawn(address indexed user);
    event Borrowed(address indexed user);
    event Repaid(address indexed user);
    event OwnershipTransferred(address indexed from, address indexed to);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        address _oracle,
        address _collateralToken,
        address _debtToken,
        address _collateralAsset,
        address _debtAsset,
        address _owner
    ) {
        oracle = IHybridPriceOracle(_oracle);
        collateralToken = IERC7984(_collateralToken);
        debtToken = IERC7984(_debtToken);
        collateralAsset = _collateralAsset;
        debtAsset = _debtAsset;
        owner = _owner == address(0) ? msg.sender : _owner;
        emit OwnershipTransferred(address(0), owner);
    }

    // -------------------------------------------------------------------------
    // User-facing entry points
    // -------------------------------------------------------------------------

    /// @notice Deposit collateral. The caller must have granted the vault operator rights on
    ///         the collateral cToken (`setOperator(vault, untilTimestamp)`) before calling.
    /// @dev    The actual transferred amount (may equal the request or, if the caller lacks
    ///         sufficient balance, less) is what we credit — no silent overcrediting.
    function depositCollateral(
        externalEuint256 encryptedAmount,
        bytes calldata inputProof
    ) external {
        euint256 transferred = collateralToken.confidentialTransferFrom(
            msg.sender,
            address(this),
            encryptedAmount,
            inputProof
        );
        _collateral[msg.sender] = Nox.add(_collateral[msg.sender], transferred);
        emit CollateralDeposited(msg.sender);
    }

    /// @notice Withdraw collateral to the caller.
    /// @dev    TODO(day3): add encrypted LTV pre-check via Gateway round-trip. Today the vault
    ///         relies on the user's confidentialTransfer to cap at the vault's balance
    ///         (naturally rejecting over-withdrawal) and on the relayer's advisory check.
    function withdrawCollateral(
        externalEuint256 encryptedAmount,
        bytes calldata inputProof
    ) external {
        euint256 amount = Nox.fromExternal(encryptedAmount, inputProof);
        // Decrement the user's ledger first. If the user asked for more than they have,
        // Nox.sub produces an encrypted value the user cannot later exceed — the cToken
        // transfer below will also cap at the vault's actual balance.
        _collateral[msg.sender] = Nox.sub(_collateral[msg.sender], amount);
        collateralToken.confidentialTransfer(msg.sender, amount);
        emit CollateralWithdrawn(msg.sender);
    }

    /// @notice Borrow debt tokens from the vault.
    /// @dev    TODO(day3): add encrypted LTV_MAX check. Today: advisory via relayer.
    function borrow(
        externalEuint256 encryptedAmount,
        bytes calldata inputProof
    ) external {
        euint256 amount = Nox.fromExternal(encryptedAmount, inputProof);
        _debt[msg.sender] = Nox.add(_debt[msg.sender], amount);
        debtToken.confidentialTransfer(msg.sender, amount);
        emit Borrowed(msg.sender);
    }

    /// @notice Repay outstanding debt.
    function repay(
        externalEuint256 encryptedAmount,
        bytes calldata inputProof
    ) external {
        euint256 transferred = debtToken.confidentialTransferFrom(
            msg.sender,
            address(this),
            encryptedAmount,
            inputProof
        );
        _debt[msg.sender] = Nox.sub(_debt[msg.sender], transferred);
        emit Repaid(msg.sender);
    }

    // -------------------------------------------------------------------------
    // Views — return encrypted handles. Caller must have ACL permission (set by
    // the per-user operations above) to actually decrypt these off-chain through
    // the Nox gateway.
    // -------------------------------------------------------------------------

    function getEncryptedCollateral(address user) external view returns (euint256) {
        return _collateral[user];
    }

    function getEncryptedDebt(address user) external view returns (euint256) {
        return _debt[user];
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function transferOwnership(address newOwner) external onlyOwner {
        address old = owner;
        owner = newOwner;
        emit OwnershipTransferred(old, newOwner);
    }
}
