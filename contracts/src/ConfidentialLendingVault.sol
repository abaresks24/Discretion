// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE} from "./libraries/FHE.sol";
import {IConfidentialToken} from "./interfaces/IConfidentialToken.sol";
import {IHybridPriceOracle} from "./interfaces/IHybridPriceOracle.sol";

/// @title ConfidentialLendingVault
/// @notice Single-collateral, single-debt lending vault whose balances are confidential
///         (ERC-7984 via iExec Nox). Collateral and debt amounts are stored as encrypted
///         handles and never revealed on-chain; LTV / health factor are computed on
///         ciphertexts and decrypted client-side with the user's view key.
/// @dev    Placeholder FHE operations live in `libraries/FHE.sol`. Every arithmetic line is
///         marked `// FIXME(nox): ...` — swap those for Nox/TFHE primitives after the
///         April 17 workshop. See CLAUDE.md §5.2 and §15.
contract ConfidentialLendingVault {
    using FHE for FHE.euint64;
    using FHE for FHE.ebool;

    // -------------------------------------------------------------------------
    // Config (immutable or owner-settable at deploy time)
    // -------------------------------------------------------------------------

    /// @notice LTV at which new borrows are rejected (75%).
    uint256 public constant LTV_MAX_BPS = 7500;
    /// @notice LTV above which a position becomes liquidatable (85%).
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8500;
    /// @notice Bonus given to the liquidator on top of the repaid debt (5%).
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Decimals used when quoting debt (e.g. USDC = 6).
    uint8 public immutable DEBT_DECIMALS;
    /// @notice Decimals used for collateral (e.g. WETH = 18 — truncated to uint64 inside FHE).
    uint8 public immutable COLLATERAL_DECIMALS;
    /// @notice Oracle price decimals (mirror `HybridPriceOracle.PRICE_DECIMALS`).
    uint8 public constant PRICE_DECIMALS = 8;

    IConfidentialToken public immutable collateralToken;
    IConfidentialToken public immutable debtToken;
    IHybridPriceOracle public immutable oracle;
    address public immutable collateralAsset; // underlying asset key for oracle lookup
    address public immutable debtAsset;

    address public owner;

    // -------------------------------------------------------------------------
    // Per-user encrypted accounting
    // -------------------------------------------------------------------------

    mapping(address => FHE.euint64) private _collateral;
    mapping(address => FHE.euint64) private _debt;

    /// @notice Last health-factor zone observed for a user. Kept in plaintext because
    ///         zones are coarse categorical data and are necessary to emit cross-event
    ///         alerts without leaking amounts. Zones: 0 safe, 1 warning, 2 danger,
    ///         3 liquidatable.
    mapping(address => uint8) public lastZone;

    // -------------------------------------------------------------------------
    // Events (intentionally amount-less — no leakage)
    // -------------------------------------------------------------------------

    event CollateralDeposited(address indexed user);
    event CollateralWithdrawn(address indexed user);
    event Borrowed(address indexed user);
    event Repaid(address indexed user);
    event Liquidated(address indexed user, address indexed liquidator);
    event HealthFactorThresholdCrossed(address indexed user, uint8 newZone);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotOwner();
    error ZeroAmount();
    error LtvTooHigh();
    error NotLiquidatable();
    error InsufficientCollateral();
    error InsufficientDebtToRepay();
    error TokenTransferFailed();
    error SelfLiquidation();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(
        address _oracle,
        address _collateralToken,
        address _debtToken,
        address _collateralAsset,
        address _debtAsset,
        uint8 _collateralDecimals,
        uint8 _debtDecimals,
        address _owner
    ) {
        oracle = IHybridPriceOracle(_oracle);
        collateralToken = IConfidentialToken(_collateralToken);
        debtToken = IConfidentialToken(_debtToken);
        collateralAsset = _collateralAsset;
        debtAsset = _debtAsset;
        COLLATERAL_DECIMALS = _collateralDecimals;
        DEBT_DECIMALS = _debtDecimals;
        owner = _owner == address(0) ? msg.sender : _owner;
    }

    // -------------------------------------------------------------------------
    // User-facing write functions
    // -------------------------------------------------------------------------

    /// @notice Deposit `amount` of confidential collateral. Caller must have granted the vault
    ///         an encrypted allowance on the collateral token beforehand.
    /// @dev    The caller passes an encrypted handle that Nox validates through its input
    ///         proof system. Here we accept it as an `FHE.euint64` — post-workshop this
    ///         signature will mirror whatever Nox requires (likely `externalEuint64 + bytes`).
    function depositCollateral(FHE.euint64 amount) external {
        _requireNonZero(amount);

        // FIXME(nox): replace with `collateralToken.transferFromEncrypted` once the Nox ACL
        //             model is confirmed; also grant the vault an ACL handle for future reads.
        if (!collateralToken.transferFromEncrypted(msg.sender, address(this), amount)) {
            revert TokenTransferFailed();
        }

        _collateral[msg.sender] = _collateral[msg.sender].add(amount); // FIXME(nox): FHE.add
        emit CollateralDeposited(msg.sender);
        _reassessZone(msg.sender);
    }

    /// @notice Withdraw `amount` of collateral if the position remains healthy afterwards.
    function withdrawCollateral(FHE.euint64 amount) external {
        _requireNonZero(amount);

        FHE.euint64 current = _collateral[msg.sender];
        // Guard: can't withdraw more than deposited.
        if (FHE.revealBool(amount.gt(current))) revert InsufficientCollateral();

        FHE.euint64 newCollateral = current.sub(amount); // FIXME(nox): FHE.sub

        // Simulate the resulting LTV with a fresh oracle read.
        if (_isUnhealthy(newCollateral, _debt[msg.sender])) revert LtvTooHigh();

        _collateral[msg.sender] = newCollateral;
        if (!collateralToken.transferEncrypted(msg.sender, amount)) revert TokenTransferFailed();

        emit CollateralWithdrawn(msg.sender);
        _reassessZone(msg.sender);
    }

    /// @notice Borrow `amount` of the debt token against deposited collateral.
    function borrow(FHE.euint64 amount) external {
        _requireNonZero(amount);

        FHE.euint64 newDebt = _debt[msg.sender].add(amount); // FIXME(nox): FHE.add
        if (_isOverLtvMax(_collateral[msg.sender], newDebt)) revert LtvTooHigh();

        _debt[msg.sender] = newDebt;
        if (!debtToken.transferEncrypted(msg.sender, amount)) revert TokenTransferFailed();

        emit Borrowed(msg.sender);
        _reassessZone(msg.sender);
    }

    /// @notice Repay `amount` of outstanding debt.
    function repay(FHE.euint64 amount) external {
        _requireNonZero(amount);

        FHE.euint64 current = _debt[msg.sender];
        if (FHE.revealBool(amount.gt(current))) revert InsufficientDebtToRepay();

        if (!debtToken.transferFromEncrypted(msg.sender, address(this), amount)) {
            revert TokenTransferFailed();
        }

        _debt[msg.sender] = current.sub(amount); // FIXME(nox): FHE.sub
        emit Repaid(msg.sender);
        _reassessZone(msg.sender);
    }

    /// @notice Anyone can liquidate an unhealthy position by repaying debt on its behalf
    ///         and claiming collateral plus the liquidation bonus.
    /// @dev    MVP: the caller repays up to the bonus-adjusted cap. No waterfall.
    function liquidate(address user, FHE.euint64 repayAmount) external {
        if (user == msg.sender) revert SelfLiquidation();
        _requireNonZero(repayAmount);

        if (!_isLiquidatable(_collateral[user], _debt[user])) revert NotLiquidatable();

        FHE.euint64 currentDebt = _debt[user];
        if (FHE.revealBool(repayAmount.gt(currentDebt))) revert InsufficientDebtToRepay();

        // Pull debt token from liquidator into the vault.
        if (!debtToken.transferFromEncrypted(msg.sender, address(this), repayAmount)) {
            revert TokenTransferFailed();
        }

        // Compute seize amount in collateral units, with bonus.
        FHE.euint64 seizeAmount = _collateralFromDebt(repayAmount);
        seizeAmount = seizeAmount.mulScalar(uint64(BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS))
                                 .divScalar(uint64(BPS_DENOMINATOR));

        // Cap seize at the user's actual collateral.
        FHE.ebool cap = seizeAmount.gt(_collateral[user]);
        seizeAmount = FHE.select(cap, _collateral[user], seizeAmount);

        _debt[user] = currentDebt.sub(repayAmount);           // FIXME(nox): FHE.sub
        _collateral[user] = _collateral[user].sub(seizeAmount); // FIXME(nox): FHE.sub

        if (!collateralToken.transferEncrypted(msg.sender, seizeAmount)) {
            revert TokenTransferFailed();
        }

        emit Liquidated(user, msg.sender);
        _reassessZone(user);
    }

    // -------------------------------------------------------------------------
    // Views (handles are returned — caller needs ACL to decrypt)
    // -------------------------------------------------------------------------

    function getEncryptedCollateral(address user) external view returns (FHE.euint64) {
        return _collateral[user];
    }

    function getEncryptedDebt(address user) external view returns (FHE.euint64) {
        return _debt[user];
    }

    /// @notice Returns an encrypted LTV in basis points. Caller decrypts client-side.
    /// @dev    Computed as: debtValueUsd * BPS_DENOMINATOR / collateralValueUsd.
    function getEncryptedLtvBps(address user) external view returns (FHE.euint64) {
        return _ltvBps(_collateral[user], _debt[user]);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    // -------------------------------------------------------------------------
    // Internal: health + pricing
    // -------------------------------------------------------------------------

    function _requireNonZero(FHE.euint64 v) private pure {
        if (!FHE.isSet(v)) revert ZeroAmount();
    }

    /// @dev Computes LTV (in bps) from encrypted collateral + debt, using the oracle's current
    ///      asset prices. Prices are public scalars, so scalar mul/div stay cheap in FHE land.
    function _ltvBps(FHE.euint64 collateral, FHE.euint64 debt) private view returns (FHE.euint64) {
        (uint256 collateralPrice, ) = oracle.getPrice(collateralAsset);
        (uint256 debtPrice, ) = oracle.getPrice(debtAsset);

        // Normalise debt and collateral into a shared USD unit (price decimals = PRICE_DECIMALS).
        // value_usd = amount * price / 10^assetDecimals  (still in price decimals)
        uint64 collateralScale = uint64(10 ** COLLATERAL_DECIMALS);
        uint64 debtScale = uint64(10 ** DEBT_DECIMALS);

        FHE.euint64 collateralUsd = collateral.mulScalar(uint64(collateralPrice)).divScalar(collateralScale);
        FHE.euint64 debtUsd = debt.mulScalar(uint64(debtPrice)).divScalar(debtScale);

        // If collateral == 0, LTV is conceptually infinite — clamp to uint64 max for downstream
        // comparisons to evaluate `ltv > threshold` as true.
        if (!FHE.isSet(collateralUsd)) {
            return FHE.asEuint64(type(uint64).max);
        }

        // LTV = debtUsd * BPS / collateralUsd
        return debtUsd.mulScalar(uint64(BPS_DENOMINATOR)).divScalar(FHE.asUint64(collateralUsd));
        // FIXME(nox): the final `divScalar(FHE.asUint64(collateralUsd))` currently reveals
        //             the collateral — in real FHE we'd either (a) compare debtUsd*BPS vs
        //             threshold*collateralUsd directly without division, or (b) run an
        //             encrypted division primitive. Option (a) is preferred; rewrite the
        //             callers (`_isOverLtvMax`, `_isLiquidatable`) to use cross-multiplication.
    }

    function _isOverLtvMax(FHE.euint64 collateral, FHE.euint64 debt) private view returns (bool) {
        FHE.euint64 ltv = _ltvBps(collateral, debt);
        return FHE.revealBool(ltv.gt(FHE.asEuint64(uint64(LTV_MAX_BPS))));
    }

    function _isUnhealthy(FHE.euint64 collateral, FHE.euint64 debt) private view returns (bool) {
        FHE.euint64 ltv = _ltvBps(collateral, debt);
        return FHE.revealBool(ltv.gte(FHE.asEuint64(uint64(LIQUIDATION_THRESHOLD_BPS))));
    }

    function _isLiquidatable(FHE.euint64 collateral, FHE.euint64 debt) private view returns (bool) {
        if (!FHE.isSet(debt)) return false;
        return _isUnhealthy(collateral, debt);
    }

    /// @dev Convert an encrypted debt amount to the equivalent collateral amount.
    function _collateralFromDebt(FHE.euint64 debtAmount) private view returns (FHE.euint64) {
        (uint256 collateralPrice, ) = oracle.getPrice(collateralAsset);
        (uint256 debtPrice, ) = oracle.getPrice(debtAsset);

        uint64 collateralScale = uint64(10 ** COLLATERAL_DECIMALS);
        uint64 debtScale = uint64(10 ** DEBT_DECIMALS);

        // amount_collateral = amount_debt * debtPrice / collateralPrice,
        // then rescale between (debtDecimals) and (collateralDecimals).
        FHE.euint64 usd = debtAmount.mulScalar(uint64(debtPrice)).divScalar(debtScale);
        return usd.mulScalar(collateralScale).divScalar(uint64(collateralPrice));
    }

    /// @dev Re-evaluates the user's zone and emits `HealthFactorThresholdCrossed` if it changed.
    ///      Zones: 0 safe, 1 warning (≥60% LTV), 2 danger (≥75%), 3 liquidatable (≥85%).
    function _reassessZone(address user) private {
        uint8 z = _computeZone(user);
        if (lastZone[user] != z) {
            lastZone[user] = z;
            emit HealthFactorThresholdCrossed(user, z);
        }
    }

    /// @dev Zone computation reveals only the zone, not the underlying LTV. In the final
    ///      Nox integration this function will decrypt only the 2-bit zone result, never
    ///      the precise LTV.
    function _computeZone(address user) private view returns (uint8) {
        FHE.euint64 debt = _debt[user];
        if (!FHE.isSet(debt)) return 0;

        FHE.euint64 ltv = _ltvBps(_collateral[user], debt);
        uint64 plain = FHE.asUint64(ltv); // FIXME(nox): decrypt only the 2-bit zone via Gateway

        if (plain >= LIQUIDATION_THRESHOLD_BPS) return 3;
        if (plain >= LTV_MAX_BPS) return 2;
        if (plain >= 6000) return 1;
        return 0;
    }
}
