// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {HybridPriceOracle} from "../src/HybridPriceOracle.sol";
import {ConfidentialLendingVault} from "../src/ConfidentialLendingVault.sol";

/// @notice Deploy script for Arbitrum Sepolia. Expects these env vars:
///   - DEPLOYER_PRIVATE_KEY
///   - CHAINLINK_ETH_USD_FEED     (Chainlink ETH/USD aggregator on Arbitrum Sepolia)
///   - COLLATERAL_TOKEN           (confidential WETH address via Nox)
///   - DEBT_TOKEN                 (confidential USDC address via Nox)
///   - COLLATERAL_ASSET           (underlying key used by the oracle — WETH logical address)
///   - DEBT_ASSET                 (underlying key — USDC logical address)
///   - COLLATERAL_DECIMALS        (usually 8 in placeholder / 18 in real WETH)
///   - DEBT_DECIMALS              (6 for USDC)
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);

        address ethUsdFeed = vm.envAddress("CHAINLINK_ETH_USD_FEED");
        address collateralToken = vm.envAddress("COLLATERAL_TOKEN");
        address debtToken = vm.envAddress("DEBT_TOKEN");
        address collateralAsset = vm.envAddress("COLLATERAL_ASSET");
        address debtAsset = vm.envAddress("DEBT_ASSET");
        uint8 collateralDecimals = uint8(vm.envUint("COLLATERAL_DECIMALS"));
        uint8 debtDecimals = uint8(vm.envUint("DEBT_DECIMALS"));

        vm.startBroadcast(pk);

        HybridPriceOracle oracle = new HybridPriceOracle(deployer);
        oracle.setFeed(collateralAsset, ethUsdFeed);
        // USDC is not fed by Chainlink on testnet — use a manual override of $1.
        oracle.setManualOverride(debtAsset, 1 * 1e8);

        ConfidentialLendingVault vault = new ConfidentialLendingVault(
            address(oracle),
            collateralToken,
            debtToken,
            collateralAsset,
            debtAsset,
            collateralDecimals,
            debtDecimals,
            deployer
        );

        vm.stopBroadcast();

        console2.log("HybridPriceOracle:", address(oracle));
        console2.log("ConfidentialLendingVault:", address(vault));
    }
}
