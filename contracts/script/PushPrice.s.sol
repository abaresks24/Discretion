// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import {HybridPriceOracle} from "../src/HybridPriceOracle.sol";

/// @notice Owner helper to push a demo price onto the oracle.
/// Env vars:
///   - DEPLOYER_PRIVATE_KEY
///   - ORACLE_ADDRESS
///   - PRICE_ASSET     (e.g. the collateral asset address)
///   - PRICE_USD_8DEC  (price in 8 decimals, e.g. 2500_00000000 for $2500)
contract PushPrice is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address oracleAddr = vm.envAddress("ORACLE_ADDRESS");
        address asset = vm.envAddress("PRICE_ASSET");
        uint256 price = vm.envUint("PRICE_USD_8DEC");

        vm.startBroadcast(pk);
        HybridPriceOracle(oracleAddr).setManualOverride(asset, price);
        vm.stopBroadcast();

        console2.log("Pushed price for", asset);
        console2.log("Price (8 dec):", price);
    }
}
