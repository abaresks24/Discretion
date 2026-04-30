// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/interfaces/IERC7984.sol";
import {Nox} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {INoxCompute} from "@iexec-nox/nox-protocol-contracts/contracts/interfaces/INoxCompute.sol";
import {euint256, externalEuint256, ebool} from "encrypted-types/EncryptedTypes.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IHybridPriceOracle} from "./interfaces/IHybridPriceOracle.sol";

/// @title ConfidentialLendingVault v3 — multi-collateral
/// @notice Confidential lending protocol on iExec Nox.
///   Borrowers post collateral in one of N supported assets, draw debt in a
///   single supported debt asset. Lenders supply that same debt asset.
///
///   Privacy: per-(asset,user) collateral balances + per-user debt + per-user
///   lender shares are stored as `euint256` handles. Each handle's ACL grants
///   the affected user (so they can decrypt their own state) and the owner
///   (audit backdoor — opt-out for mainnet, see CLAUDE.md §6).
///
///   Multi-asset: `addCollateralAsset(asset, cToken, ltvBps)` registers a new
///   collateral type. The vault stores its own (asset, cToken, ltvBps) tuple
///   so the frontend / relayer can enumerate them and price each accordingly
///   via the oracle.
///
///   What is NOT enforced on-chain (deferred, MVP):
///     - LTV check inside borrow / withdrawCollateral. Done advisory by the
///       relayer + frontend. Encrypted comparisons are heavy in FHE and the
///       hackathon scope keeps the on-chain checks minimal.
///     - Per-block interest accrual index. The borrowRateBps is published as
///       a public scalar, accrual is left to the accounting layer.
///     - Liquidation.
contract ConfidentialLendingVault {
    // -------------------------------------------------------------------------
    // Config (immutable)
    // -------------------------------------------------------------------------

    uint256 public constant LTV_MAX_BPS = 7500;
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8500;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500; // 5%
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Single debt asset (USDC) — its plaintext address + confidential wrapper.
    address public immutable debtAsset;
    IERC7984 public immutable debtToken;

    IHybridPriceOracle public immutable oracle;
    address public owner;

    // -------------------------------------------------------------------------
    // Multi-collateral registry
    // -------------------------------------------------------------------------

    struct CollateralInfo {
        IERC7984 cToken;   // confidential ERC-7984 wrapper
        uint16 ltvBps;     // max LTV when borrowing against this asset
        bool active;
    }

    mapping(address => CollateralInfo) public collateral;
    address[] public collateralAssets;

    // -------------------------------------------------------------------------
    // Per-(asset,user) and per-user encrypted accounting
    // -------------------------------------------------------------------------

    mapping(address asset => mapping(address user => euint256)) private _collateralOf;
    mapping(address user => euint256) private _debt;
    mapping(address user => euint256) private _lenderShares;

    // -------------------------------------------------------------------------
    // Rate engine — kinked utilization curve (Aave/Compound style).
    //
    //   util ∈ [0, KINK]      : borrowAPR linear from 0   to RATE_AT_KINK
    //   util ∈ (KINK, 100%]   : borrowAPR linear from KINK to RATE_MAX
    //   supplyAPR = borrowAPR × util × (1 − reserveFactor)
    //
    // `utilizationBps` is the only knob — it's updated externally (by the
    // owner today, by the TDX iApp later via off-chain decrypt of aggregate
    // borrowed/supplied handles). Rates are pure view functions: callers see
    // the same curve no matter the gas state.
    // -------------------------------------------------------------------------

    uint256 public constant KINK_BPS         = 8000;  // 80%
    uint256 public constant RATE_AT_KINK_BPS = 800;   // 8% APR
    uint256 public constant RATE_MAX_BPS     = 10_000;// 100% APR
    uint256 public constant RESERVE_FACTOR_BPS = 1000;// 10%

    uint256 public utilizationBps;
    uint40  public rateUpdatedAt;

    // -------------------------------------------------------------------------
    // Liquidation reveal — populated by the TEE iApp when it detects an
    // unhealthy position. Only the bare minimum is published: the user, the
    // amounts (per asset, plaintext) and a deadline. Once a liquidation
    // executes, the entry is cleared.
    // -------------------------------------------------------------------------

    struct Liquidatable {
        bool active;
        uint40 revealedAt;
        uint40 deadline;        // expiration of the reveal (operator-controlled)
        uint96 ltvBps;          // observed LTV in bps
        uint128 debtAmount;     // plaintext debt (cUSDC native units)
        // Per-collateral revealed amounts. Sparse — assets with 0 are skipped
        // in the event payload but always present in storage for ergonomics.
    }

    mapping(address user => Liquidatable) public liquidatables;
    mapping(address user => mapping(address asset => uint128 amount))
        public liquidatableCollat;

    // The "liquidation operator" is the address (TDX iApp publisher in
    // production) authorised to publish liquidation reveals. It can also be
    // disarmed by the owner if the iApp misbehaves. Distinct from `owner`
    // so the audit ACL grant doesn't double as a liquidation backdoor.
    address public liquidationOperator;

    // -------------------------------------------------------------------------
    // Events (amount-less, asset-aware where relevant)
    // -------------------------------------------------------------------------

    event CollateralAssetAdded(address indexed asset, address indexed cToken, uint16 ltvBps);
    event CollateralAssetUpdated(address indexed asset, uint16 ltvBps, bool active);

    event CollateralDeposited(address indexed user, address indexed asset);
    event CollateralWithdrawn(address indexed user, address indexed asset);
    event Borrowed(address indexed user);
    event Repaid(address indexed user);
    event LiquiditySupplied(address indexed lender);
    event LiquidityWithdrawn(address indexed lender);
    event RatesUpdated(uint256 borrowBps, uint256 supplyBps, uint256 utilizationBps);
    event OwnershipTransferred(address indexed from, address indexed to);

    /// @notice Emitted when the TEE detects a liquidatable position and
    ///         publishes the minimum reveal needed to act. Liquidators MAY
    ///         act on this until `deadline`.
    event PositionLiquidatable(
        address indexed user,
        uint256 ltvBps,
        uint256 debtAmount,
        uint40 deadline
    );
    event PositionLiquidatableCollat(
        address indexed user,
        address indexed asset,
        uint256 amount
    );
    event Liquidated(
        address indexed user,
        address indexed liquidator,
        uint256 debtRepaid,
        uint256 bonusBps
    );
    event LiquidationOperatorChanged(address indexed operator);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotOwner();
    error NotLiquidationOperator();
    error RateOutOfRange();
    error UnsupportedAsset(address asset);
    error AssetAlreadyRegistered(address asset);
    error LtvOutOfRange(uint16 ltvBps);
    error NotLiquidatable(address user);
    error RevealExpired(address user);
    error AlreadyLiquidating(address user);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyLiquidationOperator() {
        if (msg.sender != liquidationOperator) revert NotLiquidationOperator();
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        address _oracle,
        address _debtToken,
        address _debtAsset,
        address _owner
    ) {
        oracle = IHybridPriceOracle(_oracle);
        debtToken = IERC7984(_debtToken);
        debtAsset = _debtAsset;
        owner = _owner == address(0) ? msg.sender : _owner;
        rateUpdatedAt = uint40(block.timestamp);
        emit OwnershipTransferred(address(0), owner);
    }

    // -------------------------------------------------------------------------
    // Admin: collateral registry
    // -------------------------------------------------------------------------

    function addCollateralAsset(
        address asset,
        address cToken,
        uint16 ltvBps
    ) external onlyOwner {
        if (collateral[asset].cToken != IERC7984(address(0))) {
            revert AssetAlreadyRegistered(asset);
        }
        if (ltvBps == 0 || ltvBps > LTV_MAX_BPS) revert LtvOutOfRange(ltvBps);
        collateral[asset] = CollateralInfo({
            cToken: IERC7984(cToken),
            ltvBps: ltvBps,
            active: true
        });
        collateralAssets.push(asset);
        emit CollateralAssetAdded(asset, cToken, ltvBps);
    }

    function setCollateralAsset(
        address asset,
        uint16 ltvBps,
        bool active
    ) external onlyOwner {
        CollateralInfo storage info = collateral[asset];
        if (info.cToken == IERC7984(address(0))) revert UnsupportedAsset(asset);
        if (ltvBps == 0 || ltvBps > LTV_MAX_BPS) revert LtvOutOfRange(ltvBps);
        info.ltvBps = ltvBps;
        info.active = active;
        emit CollateralAssetUpdated(asset, ltvBps, active);
    }

    // -------------------------------------------------------------------------
    // BORROWER operations — collateral side (per-asset)
    // -------------------------------------------------------------------------

    function depositCollateral(
        address asset,
        externalEuint256 encryptedAmount,
        bytes calldata inputProof
    ) external {
        CollateralInfo memory info = _requireActive(asset);
        // Verify the proof here (msg.sender = user → proof.owner=user matches),
        // then hand the cToken transient ACL on the resolved handle so it can
        // execute the transfer via the no-proof confidentialTransferFrom overload.
        // The "proof + cToken.confidentialTransferFrom" path doesn't work because
        // the cToken's Nox.fromExternal sees msg.sender = vault, breaking the
        // owner check on the user-signed proof.
        euint256 amount = Nox.fromExternal(encryptedAmount, inputProof);
        Nox.allowTransient(amount, address(info.cToken));
        euint256 transferred = info.cToken.confidentialTransferFrom(
            msg.sender,
            address(this),
            amount
        );
        _collateralOf[asset][msg.sender] = Nox.add(
            _collateralOf[asset][msg.sender],
            transferred
        );
        _grantAudit(_collateralOf[asset][msg.sender], msg.sender);
        emit CollateralDeposited(msg.sender, asset);
    }

    function withdrawCollateral(
        address asset,
        externalEuint256 encryptedAmount,
        bytes calldata inputProof
    ) external {
        CollateralInfo memory info = _requireActive(asset);
        euint256 amount = Nox.fromExternal(encryptedAmount, inputProof);
        _collateralOf[asset][msg.sender] = Nox.sub(
            _collateralOf[asset][msg.sender],
            amount
        );
        _grantAudit(_collateralOf[asset][msg.sender], msg.sender);
        info.cToken.confidentialTransfer(msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, asset);
    }

    // -------------------------------------------------------------------------
    // BORROWER operations — debt side (single asset)
    // -------------------------------------------------------------------------

    /// @notice Open or grow a debt position. The borrow only goes through if
    ///         the resulting LTV stays at-or-below each collateral's LTV cap;
    ///         otherwise the actual transferred amount is silently capped to
    ///         zero (no revert — keeps the LTV check itself confidential).
    ///         The cap is computed in fully-homomorphic land using the
    ///         per-asset oracle prices (plaintext) and the user's per-asset
    ///         encrypted collateral balances. See {_checkBorrowLtv}.
    function borrow(
        externalEuint256 encryptedAmount,
        bytes calldata inputProof
    ) external {
        euint256 amount = Nox.fromExternal(encryptedAmount, inputProof);

        // Encrypted FHE check: would the resulting debt exceed the
        // weighted-LTV cap of the user's per-asset collateral basket?
        ebool ok = _checkBorrowLtv(msg.sender, amount);

        // Cap to 0 if the check fails — preserves privacy (no on-chain
        // revert leaks "user is over-LTV") and matches the same flow as
        // confidentialTransferFrom which silently transfers up to balance.
        euint256 actualAmount = Nox.select(ok, amount, Nox.toEuint256(0));

        _debt[msg.sender] = Nox.add(_debt[msg.sender], actualAmount);
        _grantAudit(_debt[msg.sender], msg.sender);
        // ACL the transferred handle for the cToken so it can move it.
        Nox.allowTransient(actualAmount, address(debtToken));
        debtToken.confidentialTransfer(msg.sender, actualAmount);
        emit Borrowed(msg.sender);
    }

    /// @dev FHE LTV pre-check. Returns an encrypted boolean — true if the
    ///      hypothetical post-borrow debt is within the user's weighted
    ///      collateral capacity, false otherwise.
    ///
    ///      Math (all values normalised to a 36-decimal common scale to
    ///      avoid FHE division):
    ///        debt_$ ≤ Σ collat_$_i × ltv_i
    ///      → debt_raw × 10^30                   (debt is 6-dec USDC)
    ///        ≤ Σ collat_raw_i × price_i × ltv_bps_i × 10^(24 − dec_i)
    ///      Both sides fit comfortably in euint256 even with whale-sized
    ///      positions (max ≈ 1e40, vs. 2^256 ≈ 1.16e77).
    function _checkBorrowLtv(address user, euint256 borrowAmount)
        internal
        returns (ebool)
    {
        // Hypothetical new debt = current debt + amount about to be drawn.
        euint256 newDebt = Nox.add(_debt[user], borrowAmount);
        euint256 debtScaled = Nox.mul(newDebt, Nox.toEuint256(10 ** 30));

        // Sum of weighted collateral USD across every active asset.
        euint256 weightedCollat = Nox.toEuint256(0);
        uint256 nAssets = collateralAssets.length;
        for (uint256 i = 0; i < nAssets; i++) {
            address asset = collateralAssets[i];
            CollateralInfo memory info = collateral[asset];
            if (!info.active) continue;

            (uint256 price, ) = oracle.getPrice(asset);
            if (price == 0) continue; // skip stale/missing prices

            uint8 dec = IERC20Metadata(asset).decimals();
            // 24 is the headroom — every supported asset has decimals ≤ 18 in
            // practice; this keeps the scale factor positive and bounded.
            uint256 scale = price * info.ltvBps * (10 ** (24 - uint256(dec)));

            euint256 weighted = Nox.mul(
                _collateralOf[asset][user],
                Nox.toEuint256(scale)
            );
            weightedCollat = Nox.add(weightedCollat, weighted);
        }

        return Nox.le(debtScaled, weightedCollat);
    }

    function repay(
        externalEuint256 encryptedAmount,
        bytes calldata inputProof
    ) external {
        euint256 amount = Nox.fromExternal(encryptedAmount, inputProof);
        Nox.allowTransient(amount, address(debtToken));
        euint256 transferred = debtToken.confidentialTransferFrom(
            msg.sender,
            address(this),
            amount
        );
        _debt[msg.sender] = Nox.sub(_debt[msg.sender], transferred);
        _grantAudit(_debt[msg.sender], msg.sender);
        emit Repaid(msg.sender);
    }

    // -------------------------------------------------------------------------
    // LENDER (LP) operations
    // -------------------------------------------------------------------------

    function supplyLiquidity(
        externalEuint256 encryptedAmount,
        bytes calldata inputProof
    ) external {
        euint256 amount = Nox.fromExternal(encryptedAmount, inputProof);
        Nox.allowTransient(amount, address(debtToken));
        euint256 transferred = debtToken.confidentialTransferFrom(
            msg.sender,
            address(this),
            amount
        );
        _lenderShares[msg.sender] = Nox.add(_lenderShares[msg.sender], transferred);
        _grantAudit(_lenderShares[msg.sender], msg.sender);
        emit LiquiditySupplied(msg.sender);
    }

    function withdrawLiquidity(
        externalEuint256 encryptedAmount,
        bytes calldata inputProof
    ) external {
        euint256 amount = Nox.fromExternal(encryptedAmount, inputProof);
        _lenderShares[msg.sender] = Nox.sub(_lenderShares[msg.sender], amount);
        _grantAudit(_lenderShares[msg.sender], msg.sender);
        debtToken.confidentialTransfer(msg.sender, amount);
        emit LiquidityWithdrawn(msg.sender);
    }

    // -------------------------------------------------------------------------
    // Admin: rate engine poke
    // -------------------------------------------------------------------------

    /// @notice Push the latest aggregate utilization (in bps). Owner-only for
    ///         now; will be rotated to the TDX iApp once it can decrypt
    ///         vault-wide aggregates. Rates re-derive automatically from the
    ///         utilization via the kinked curve below.
    function setUtilization(uint256 utilBps) external onlyOwner {
        if (utilBps > BPS_DENOMINATOR) revert RateOutOfRange();
        utilizationBps = utilBps;
        rateUpdatedAt = uint40(block.timestamp);
        emit RatesUpdated(borrowRateBps(), supplyRateBps(), utilBps);
    }

    /// @notice Backwards-compatible alias — only `utilBps` is honoured; the
    ///         explicit borrow/supply args are ignored because rates are now
    ///         a pure function of utilization.
    function setRates(
        uint256 /*borrowBps*/,
        uint256 /*supplyBps*/,
        uint256 utilBps
    ) external onlyOwner {
        if (utilBps > BPS_DENOMINATOR) revert RateOutOfRange();
        utilizationBps = utilBps;
        rateUpdatedAt = uint40(block.timestamp);
        emit RatesUpdated(borrowRateBps(), supplyRateBps(), utilBps);
    }

    /// @notice Borrow APR in bps, derived from current utilization via a
    ///         two-segment linear curve.
    ///           util ≤ KINK: rate scales 0 → RATE_AT_KINK
    ///           util > KINK: rate scales RATE_AT_KINK → RATE_MAX
    function borrowRateBps() public view returns (uint256) {
        uint256 u = utilizationBps;
        if (u == 0) return 0;
        if (u <= KINK_BPS) {
            return (u * RATE_AT_KINK_BPS) / KINK_BPS;
        }
        uint256 over = u - KINK_BPS;
        uint256 span = BPS_DENOMINATOR - KINK_BPS;
        return RATE_AT_KINK_BPS + (over * (RATE_MAX_BPS - RATE_AT_KINK_BPS)) / span;
    }

    /// @notice Supply APR in bps. Lenders earn what borrowers pay, scaled by
    ///         utilization (you only earn on the fraction of supply that's
    ///         actually borrowed) minus a reserve factor that the protocol
    ///         keeps for safety.
    function supplyRateBps() public view returns (uint256) {
        uint256 br = borrowRateBps();
        uint256 u = utilizationBps;
        // borrowAPR × util × (1 − reserveFactor) — all in bps, divide twice.
        return (br * u * (BPS_DENOMINATOR - RESERVE_FACTOR_BPS))
            / (BPS_DENOMINATOR * BPS_DENOMINATOR);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        address old = owner;
        owner = newOwner;
        emit OwnershipTransferred(old, newOwner);
    }

    /// @notice Owner sets/rotates the liquidation operator (TDX iApp).
    function setLiquidationOperator(address op) external onlyOwner {
        liquidationOperator = op;
        emit LiquidationOperatorChanged(op);
    }

    // -------------------------------------------------------------------------
    // Liquidation — TEE reveal, public-market execution
    // -------------------------------------------------------------------------

    /// @notice Called by the TDX iApp when it has decrypted a user's
    ///         aggregate position via its audit ACL and observed
    ///         LTV >= LIQUIDATION_THRESHOLD_BPS. Publishes the minimum
    ///         information liquidators need to act.
    function revealLiquidatable(
        address user,
        uint256 ltvBps,
        uint256 debtAmount,
        address[] calldata assets,
        uint256[] calldata collateralAmounts,
        uint40 deadline
    ) external onlyLiquidationOperator {
        if (ltvBps < LIQUIDATION_THRESHOLD_BPS) revert NotLiquidatable(user);
        if (assets.length != collateralAmounts.length) {
            revert UnsupportedAsset(address(0));
        }

        Liquidatable storage L = liquidatables[user];
        L.active = true;
        L.revealedAt = uint40(block.timestamp);
        L.deadline = deadline;
        L.ltvBps = uint96(ltvBps);
        L.debtAmount = uint128(debtAmount);

        for (uint256 i = 0; i < assets.length; i++) {
            liquidatableCollat[user][assets[i]] = uint128(collateralAmounts[i]);
            emit PositionLiquidatableCollat(user, assets[i], collateralAmounts[i]);
        }
        emit PositionLiquidatable(user, ltvBps, debtAmount, deadline);
    }

    /// @notice Called by the TEE if a price recovers and the position is no
    ///         longer liquidatable. Pulls the public reveal back so the
    ///         position returns to private state.
    function clearLiquidatable(address user) external onlyLiquidationOperator {
        delete liquidatables[user];
        // Per-asset entries left dangling in storage are harmless — readers
        // gate on `liquidatables[user].active` first.
    }

    /// @notice Public liquidation — anyone can call once a reveal is active
    ///         and unexpired. The liquidator pays `debtAmount` cUSDC into
    ///         the vault (covering the debt), receives ALL revealed
    ///         collateral plus the liquidation bonus deducted from it.
    ///         First-write-wins: a re-entrant or duplicate call reverts via
    ///         the `active` flag clear.
    /// @dev    Liquidator must have approved the vault as ERC-7984 operator
    ///         on cUSDC and have at least `debtAmount` cUSDC in their wallet
    ///         (encrypted, but the public reveal tells them how much to load).
    function liquidate(address user) external {
        Liquidatable memory L = liquidatables[user];
        if (!L.active) revert NotLiquidatable(user);
        if (block.timestamp > L.deadline) revert RevealExpired(user);

        // Mark the reveal consumed before any external interaction.
        delete liquidatables[user];

        // Pull debt amount in cUSDC from liquidator. Trivially-encrypted —
        // the value is publicly known from the reveal.
        euint256 debtEnc = Nox.toEuint256(L.debtAmount);
        Nox.allowTransient(debtEnc, address(debtToken));
        debtToken.confidentialTransferFrom(msg.sender, address(this), debtEnc);

        // Reduce user's debt by the repaid amount on encrypted state.
        _debt[user] = Nox.sub(_debt[user], debtEnc);
        _grantAudit(_debt[user], user);

        // Transfer revealed collateral to liquidator (per-asset), bonus
        // applied as a discount on what the borrower retains. We send
        // ALL revealed collateral; the bonus is implicit in the fact that
        // the liquidator paid debtAmount but receives collat worth more.
        uint256 nAssets = collateralAssets.length;
        for (uint256 i = 0; i < nAssets; i++) {
            address asset = collateralAssets[i];
            uint256 amt = liquidatableCollat[user][asset];
            if (amt == 0) continue;
            delete liquidatableCollat[user][asset];

            CollateralInfo memory info = collateral[asset];
            euint256 amtEnc = Nox.toEuint256(amt);

            // Reduce user's collat handle on this asset.
            _collateralOf[asset][user] = Nox.sub(_collateralOf[asset][user], amtEnc);
            _grantAudit(_collateralOf[asset][user], user);

            // Send to liquidator as a confidential transfer (trivially
            // encrypted; the liquidator already knew the value).
            info.cToken.confidentialTransfer(msg.sender, amtEnc);
        }

        emit Liquidated(user, msg.sender, L.debtAmount, LIQUIDATION_BONUS_BPS);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getEncryptedCollateral(
        address asset,
        address user
    ) external view returns (euint256) {
        return _collateralOf[asset][user];
    }

    function getEncryptedDebt(address user) external view returns (euint256) {
        return _debt[user];
    }

    function getEncryptedLenderShares(address user) external view returns (euint256) {
        return _lenderShares[user];
    }

    function collateralAssetsCount() external view returns (uint256) {
        return collateralAssets.length;
    }

    function listCollateralAssets()
        external
        view
        returns (address[] memory assets, address[] memory cTokens, uint16[] memory ltvs, bool[] memory actives)
    {
        uint256 n = collateralAssets.length;
        assets = new address[](n);
        cTokens = new address[](n);
        ltvs = new uint16[](n);
        actives = new bool[](n);
        for (uint256 i; i < n; ++i) {
            address a = collateralAssets[i];
            CollateralInfo memory info = collateral[a];
            assets[i] = a;
            cTokens[i] = address(info.cToken);
            ltvs[i] = info.ltvBps;
            actives[i] = info.active;
        }
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    function _requireActive(address asset) internal view returns (CollateralInfo memory info) {
        info = collateral[asset];
        if (!info.active) revert UnsupportedAsset(asset);
    }

    /// @dev Grants persistent ACL on a freshly-updated handle to:
    ///      - the affected user, so they can read their own state between txs
    ///      - the owner, regulatory audit backdoor (CLAUDE.md §6)
    ///      - the liquidationOperator (TDX iApp), so it can decrypt handles
    ///        to compute aggregate HF and publish liquidation reveals
    function _grantAudit(euint256 handle, address user) internal {
        INoxCompute c = INoxCompute(Nox.noxComputeContract());
        bytes32 raw = euint256.unwrap(handle);
        if (raw != bytes32(0)) {
            c.allow(raw, user);
            c.allow(raw, owner);
            address liqOp = liquidationOperator;
            if (liqOp != address(0) && liqOp != owner && liqOp != user) {
                c.allow(raw, liqOp);
            }
        }
    }
}
