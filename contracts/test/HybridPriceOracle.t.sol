// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {HybridPriceOracle} from "../src/HybridPriceOracle.sol";
import {IHybridPriceOracle} from "../src/interfaces/IHybridPriceOracle.sol";
import {MockAggregator} from "./mocks/MockAggregator.sol";

contract HybridPriceOracleTest is Test {
    HybridPriceOracle internal oracle;
    MockAggregator internal feed8;
    MockAggregator internal feed18;

    address internal constant WETH = address(0xAAA);
    address internal constant USDC = address(0xBBB);
    address internal constant OWNER = address(0xDEAD);
    address internal constant STRANGER = address(0xBEEF);

    function setUp() public {
        oracle = new HybridPriceOracle(OWNER);
        feed8 = new MockAggregator(8, 3000 * 1e8);     // ETH/USD @ $3000
        feed18 = new MockAggregator(18, 1 * 1e18);      // USDC/USD @ $1 (pretend 18 decimals)
    }

    function test_SetFeed_OnlyOwner() public {
        vm.prank(STRANGER);
        vm.expectRevert(HybridPriceOracle.NotOwner.selector);
        oracle.setFeed(WETH, address(feed8));

        vm.prank(OWNER);
        oracle.setFeed(WETH, address(feed8));
        assertEq(oracle.feedOf(WETH), address(feed8));
    }

    function test_GetPrice_FromChainlink() public {
        vm.prank(OWNER);
        oracle.setFeed(WETH, address(feed8));

        (uint256 price, uint256 ts) = oracle.getPrice(WETH);
        assertEq(price, 3000 * 1e8);
        assertEq(ts, block.timestamp);
    }

    function test_GetPrice_NormalisesFeedDecimals() public {
        vm.prank(OWNER);
        oracle.setFeed(USDC, address(feed18));

        (uint256 price, ) = oracle.getPrice(USDC);
        // 1e18 scaled from 18 decimals down to 8 => 1e8
        assertEq(price, 1e8);
    }

    function test_ManualOverride_TakesPrecedence() public {
        vm.prank(OWNER);
        oracle.setFeed(WETH, address(feed8));

        vm.prank(OWNER);
        oracle.setManualOverride(WETH, 2500 * 1e8);

        (uint256 price, uint256 ts) = oracle.getPrice(WETH);
        assertEq(price, 2500 * 1e8);
        assertEq(ts, block.timestamp);
        assertTrue(oracle.isOverridden(WETH));
    }

    function test_ClearManualOverride_FallsBackToFeed() public {
        vm.prank(OWNER);
        oracle.setFeed(WETH, address(feed8));
        vm.prank(OWNER);
        oracle.setManualOverride(WETH, 2500 * 1e8);
        vm.prank(OWNER);
        oracle.clearManualOverride(WETH);

        (uint256 price, ) = oracle.getPrice(WETH);
        assertEq(price, 3000 * 1e8);
        assertFalse(oracle.isOverridden(WETH));
    }

    function test_Revert_FeedNotSet() public {
        vm.expectRevert(abi.encodeWithSelector(HybridPriceOracle.FeedNotSet.selector, WETH));
        oracle.getPrice(WETH);
    }

    function test_Revert_FeedStale() public {
        vm.prank(OWNER);
        oracle.setFeed(WETH, address(feed8));

        // Move time past the staleness threshold without updating the feed.
        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert();
        oracle.getPrice(WETH);
    }

    function test_Revert_NegativePrice() public {
        vm.prank(OWNER);
        oracle.setFeed(WETH, address(feed8));
        feed8.setAnswer(-1);

        vm.expectRevert();
        oracle.getPrice(WETH);
    }

    function test_Revert_ZeroOverridePrice() public {
        vm.prank(OWNER);
        vm.expectRevert(HybridPriceOracle.ZeroPrice.selector);
        oracle.setManualOverride(WETH, 0);
    }
}
