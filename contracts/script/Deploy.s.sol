// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import {HybridPriceOracle} from "../src/HybridPriceOracle.sol";
import {ConfidentialLendingVault} from "../src/ConfidentialLendingVault.sol";

/// @notice Deploy script for Arbitrum Sepolia.
///
/// Required env vars:
///   - DEPLOYER_PRIVATE_KEY
///   - COLLATERAL_TOKEN                      (cRLC pre-deployed on Sepolia)
///   - DEBT_TOKEN                            (cUSDC pre-deployed on Sepolia)
///   - COLLATERAL_ASSET                      (plaintext RLC — oracle key)
///   - DEBT_ASSET                            (plaintext USDC — oracle key)
///   - COLLATERAL_INITIAL_PRICE_USD_8DEC     (e.g. 150000000 for $1.50)
///   - DEBT_INITIAL_PRICE_USD_8DEC           (e.g. 100000000 for $1.00)
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);

        address collateralToken = vm.envAddress("COLLATERAL_TOKEN");
        address debtToken = vm.envAddress("DEBT_TOKEN");
        address collateralAsset = vm.envAddress("COLLATERAL_ASSET");
        address debtAsset = vm.envAddress("DEBT_ASSET");
        uint256 collateralPrice = vm.envUint("COLLATERAL_INITIAL_PRICE_USD_8DEC");
        uint256 debtPrice = vm.envUint("DEBT_INITIAL_PRICE_USD_8DEC");

        vm.startBroadcast(pk);

        HybridPriceOracle oracle = new HybridPriceOracle(deployer);
        // RLC/USD and USDC/USD aren't on Chainlink Sepolia — seed manual overrides.
        oracle.setManualOverride(collateralAsset, collateralPrice);
        oracle.setManualOverride(debtAsset, debtPrice);

        ConfidentialLendingVault vault = new ConfidentialLendingVault(
            address(oracle),
            collateralToken,
            debtToken,
            collateralAsset,
            debtAsset,
            deployer
        );

        vm.stopBroadcast();

        console2.log("HybridPriceOracle      :", address(oracle));
        console2.log("ConfidentialLendingVault:", address(vault));
        console2.log("cRLC  (collateralToken):", collateralToken);
        console2.log("cUSDC (debtToken)      :", debtToken);
    }
}
