// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {HybridPriceOracle} from "../src/HybridPriceOracle.sol";
import {ConfidentialLendingVault} from "../src/ConfidentialLendingVault.sol";
import {FHE} from "../src/libraries/FHE.sol";
import {MockAggregator} from "./mocks/MockAggregator.sol";
import {MockConfidentialToken} from "./mocks/MockConfidentialToken.sol";

contract ConfidentialLendingVaultTest is Test {
    HybridPriceOracle internal oracle;
    ConfidentialLendingVault internal vault;
    MockConfidentialToken internal collateralToken;
    MockConfidentialToken internal debtToken;
    MockAggregator internal wethFeed;
    MockAggregator internal usdcFeed;

    address internal constant WETH = address(0xAAAA);
    address internal constant USDC = address(0xBBBB);
    address internal constant OWNER = address(0xDEAD);
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);

    uint8 internal constant COLLATERAL_DECS = 8; // collapsed to fit uint64 in the placeholder
    uint8 internal constant DEBT_DECS = 6;

    function setUp() public {
        oracle = new HybridPriceOracle(OWNER);
        wethFeed = new MockAggregator(8, 3000 * 1e8);
        usdcFeed = new MockAggregator(8, 1 * 1e8);

        vm.startPrank(OWNER);
        oracle.setFeed(WETH, address(wethFeed));
        oracle.setFeed(USDC, address(usdcFeed));
        vm.stopPrank();

        collateralToken = new MockConfidentialToken();
        debtToken = new MockConfidentialToken();

        vault = new ConfidentialLendingVault(
            address(oracle),
            address(collateralToken),
            address(debtToken),
            WETH,
            USDC,
            COLLATERAL_DECS,
            DEBT_DECS,
            OWNER
        );

        // Seed balances: Alice has 1 WETH equivalent (1e8 units at 8 decs), vault has USDC to lend.
        collateralToken.mint(ALICE, 1 * 1e8);
        debtToken.mint(address(vault), 10_000 * 1e6); // 10k USDC liquidity
        debtToken.mint(BOB, 10_000 * 1e6);            // Bob is a potential liquidator
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _e(uint64 v) internal pure returns (FHE.euint64) {
        return FHE.asEuint64(v);
    }

    function _ltv(address user) internal view returns (uint64) {
        return FHE.asUint64(vault.getEncryptedLtvBps(user));
    }

    function _collat(address user) internal view returns (uint64) {
        return FHE.asUint64(vault.getEncryptedCollateral(user));
    }

    function _debt(address user) internal view returns (uint64) {
        return FHE.asUint64(vault.getEncryptedDebt(user));
    }

    // -------------------------------------------------------------------------
    // Deposit
    // -------------------------------------------------------------------------

    function test_Deposit_UpdatesCollateral() public {
        vm.prank(ALICE);
        vault.depositCollateral(_e(1 * 1e8));

        assertEq(_collat(ALICE), 1 * 1e8);
        assertEq(collateralToken.balances(ALICE), 0);
        assertEq(collateralToken.balances(address(vault)), 1 * 1e8);
    }

    function test_Deposit_EmitsZoneEventFromNoneToSafe() public {
        vm.prank(ALICE);
        // No debt => zone stays 0; no crossing event (lastZone already 0).
        vm.recordLogs();
        vault.depositCollateral(_e(1 * 1e8));
        Vm.Log[] memory logs = vm.getRecordedLogs();
        // Expect: CollateralDeposited only (no HealthFactorThresholdCrossed).
        uint256 crossings = 0;
        for (uint256 i = 0; i < logs.length; ++i) {
            if (logs[i].topics[0] == keccak256("HealthFactorThresholdCrossed(address,uint8)")) {
                crossings++;
            }
        }
        assertEq(crossings, 0);
    }

    // -------------------------------------------------------------------------
    // Borrow
    // -------------------------------------------------------------------------

    function test_Borrow_Succeeds_UnderLtvMax() public {
        vm.startPrank(ALICE);
        vault.depositCollateral(_e(1 * 1e8)); // $3000 collateral
        vault.borrow(_e(2000 * 1e6));         // $2000 debt => LTV ~= 6666 bps
        vm.stopPrank();

        assertEq(_debt(ALICE), 2000 * 1e6);
        assertEq(debtToken.balances(ALICE), 2000 * 1e6);
        assertApproxEqAbs(uint256(_ltv(ALICE)), 6666, 2);
    }

    function test_Borrow_Reverts_OverLtvMax() public {
        vm.startPrank(ALICE);
        vault.depositCollateral(_e(1 * 1e8));
        vm.expectRevert(ConfidentialLendingVault.LtvTooHigh.selector);
        vault.borrow(_e(2400 * 1e6)); // LTV = 80% > 75% max
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Repay
    // -------------------------------------------------------------------------

    function test_Repay_ReducesDebt() public {
        vm.startPrank(ALICE);
        vault.depositCollateral(_e(1 * 1e8));
        vault.borrow(_e(2000 * 1e6));
        vault.repay(_e(500 * 1e6));
        vm.stopPrank();

        assertEq(_debt(ALICE), 1500 * 1e6);
    }

    function test_Repay_Reverts_OverOutstanding() public {
        vm.startPrank(ALICE);
        vault.depositCollateral(_e(1 * 1e8));
        vault.borrow(_e(1000 * 1e6));
        vm.expectRevert(ConfidentialLendingVault.InsufficientDebtToRepay.selector);
        vault.repay(_e(5000 * 1e6));
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Withdraw
    // -------------------------------------------------------------------------

    function test_Withdraw_Reverts_WhenItWouldBreachLtv() public {
        vm.startPrank(ALICE);
        vault.depositCollateral(_e(1 * 1e8));
        vault.borrow(_e(2000 * 1e6)); // LTV ~66.66%
        // Withdrawing half the collateral => LTV would ~133% — must revert.
        vm.expectRevert(ConfidentialLendingVault.LtvTooHigh.selector);
        vault.withdrawCollateral(_e(5 * 1e7));
        vm.stopPrank();
    }

    function test_Withdraw_Succeeds_WhenDebtFree() public {
        vm.startPrank(ALICE);
        vault.depositCollateral(_e(1 * 1e8));
        vault.withdrawCollateral(_e(4 * 1e7));
        vm.stopPrank();

        assertEq(_collat(ALICE), 6 * 1e7);
    }

    // -------------------------------------------------------------------------
    // Zone crossings
    // -------------------------------------------------------------------------

    function test_ZoneCrossing_EmittedOnPriceDrop() public {
        vm.startPrank(ALICE);
        vault.depositCollateral(_e(1 * 1e8));
        vault.borrow(_e(2000 * 1e6)); // ~66.66% → zone 1 (warning)
        vm.stopPrank();

        assertEq(vault.lastZone(ALICE), 1);

        // Force the vault to re-evaluate via a no-op: simulate a price drop by overriding
        // the oracle, then calling repay(0)... actually repay(0) reverts on ZeroAmount.
        // Instead, Alice deposits dust to trigger a zone reassessment under the new price.
        vm.prank(OWNER);
        oracle.setManualOverride(WETH, 2500 * 1e8); // ETH to $2500 → LTV = 80% → zone 2

        collateralToken.mint(ALICE, 1); // tiny dust
        vm.prank(ALICE);
        vm.recordLogs();
        vault.depositCollateral(_e(1));

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool saw = false;
        uint8 zone;
        for (uint256 i = 0; i < logs.length; ++i) {
            if (logs[i].topics[0] == keccak256("HealthFactorThresholdCrossed(address,uint8)")) {
                saw = true;
                zone = abi.decode(logs[i].data, (uint8));
            }
        }
        assertTrue(saw, "expected zone crossing event");
        assertEq(zone, 2);
        assertEq(vault.lastZone(ALICE), 2);
    }

    // -------------------------------------------------------------------------
    // Liquidation
    // -------------------------------------------------------------------------

    function test_Liquidate_Succeeds_WhenPositionUnhealthy() public {
        vm.startPrank(ALICE);
        vault.depositCollateral(_e(1 * 1e8));
        vault.borrow(_e(2200 * 1e6)); // ~73% → healthy
        vm.stopPrank();

        // Drop ETH price so LTV crosses 85% liquidation threshold.
        vm.prank(OWNER);
        oracle.setManualOverride(WETH, 2000 * 1e8); // LTV = 110% → liquidatable

        uint64 bobCollatBefore = collateralToken.balances(BOB);

        vm.prank(BOB);
        vault.liquidate(ALICE, _e(1000 * 1e6));

        // Alice's debt went down, Bob received collateral.
        assertEq(_debt(ALICE), 1200 * 1e6);
        assertGt(collateralToken.balances(BOB), bobCollatBefore);
    }

    function test_Liquidate_Reverts_WhenHealthy() public {
        vm.startPrank(ALICE);
        vault.depositCollateral(_e(1 * 1e8));
        vault.borrow(_e(2000 * 1e6));
        vm.stopPrank();

        vm.prank(BOB);
        vm.expectRevert(ConfidentialLendingVault.NotLiquidatable.selector);
        vault.liquidate(ALICE, _e(500 * 1e6));
    }

    function test_Liquidate_RevertsOnSelfLiquidation() public {
        vm.startPrank(ALICE);
        vault.depositCollateral(_e(1 * 1e8));
        vault.borrow(_e(2000 * 1e6));
        vm.expectRevert(ConfidentialLendingVault.SelfLiquidation.selector);
        vault.liquidate(ALICE, _e(100 * 1e6));
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Fuzz: deposit+borrow within bounds never breaches LTV max
    // -------------------------------------------------------------------------

    function testFuzz_BorrowStaysUnderLtvMax(uint64 collatAmount, uint64 borrowAmount) public {
        // Ranges chosen to stay within uint64 bounds of the placeholder FHE library:
        // collat * 3000e8 must fit in uint64 (max ~1.84e19) => collat <= ~6e7.
        // borrow * 1e8 must also fit => borrow <= ~1.8e11; we cap at 5e10.
        collatAmount = uint64(bound(uint256(collatAmount), 1e7, 6e7));
        borrowAmount = uint64(bound(uint256(borrowAmount), 1e6, 5e10));

        collateralToken.mint(ALICE, collatAmount);
        debtToken.mint(address(vault), borrowAmount);

        vm.startPrank(ALICE);
        vault.depositCollateral(_e(collatAmount));

        // Compute expected LTV assuming $3000 ETH and $1 USDC:
        // debtUsd  = borrowAmount * 1e8 / 1e6           // price-decimals (8)
        // collatUsd = collatAmount * 3000e8 / 1e8        // price-decimals (8)
        // ltv_bps  = debtUsd * 10000 / collatUsd
        uint256 debtUsd = uint256(borrowAmount) * 1e8 / 1e6;
        uint256 collatUsd = uint256(collatAmount) * 3000e8 / 1e8;
        uint256 expectedLtv = debtUsd * 10000 / collatUsd;

        if (expectedLtv > 7500) {
            vm.expectRevert(ConfidentialLendingVault.LtvTooHigh.selector);
            vault.borrow(_e(borrowAmount));
        } else {
            vault.borrow(_e(borrowAmount));
            assertLe(uint256(_ltv(ALICE)), 7500);
        }
        vm.stopPrank();
    }
}
