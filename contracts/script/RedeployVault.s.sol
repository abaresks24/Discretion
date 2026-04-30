// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {ConfidentialLendingVault} from "../src/ConfidentialLendingVault.sol";

/// Redeploys ONLY the vault (FHE proof flow fix) and reuses the existing
/// oracle, queues and cToken wrappers. Run once and update env vars.
contract RedeployVault is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);

        // Existing infra (NOT redeployed).
        address oracle = vm.envAddress("ORACLE_ADDRESS");
        address cUsdc  = vm.envAddress("C_USDC_TOKEN");
        address usdc   = vm.envAddress("USDC_ASSET");
        address cRlc   = vm.envAddress("C_RLC_TOKEN");
        address rlc    = vm.envAddress("RLC_ASSET");
        address cWeth  = vm.envAddress("C_WETH_TOKEN");
        address weth   = vm.envAddress("WETH_ASSET");
        address liquidationOperator = vm.envAddress("LIQUIDATION_OPERATOR");

        uint16 ltvRlc  = 7000;
        uint16 ltvWeth = 7500;
        uint16 ltvUsdc = 7500;

        vm.startBroadcast(pk);

        ConfidentialLendingVault vault = new ConfidentialLendingVault(
            oracle,
            cUsdc,
            usdc,
            deployer
        );

        vault.addCollateralAsset(rlc,  cRlc,  ltvRlc);
        vault.addCollateralAsset(weth, cWeth, ltvWeth);
        vault.addCollateralAsset(usdc, cUsdc, ltvUsdc);

        vault.setLiquidationOperator(liquidationOperator);

        vm.stopBroadcast();

        console2.log("New ConfidentialLendingVault :", address(vault));
        console2.log("Deployer / owner             :", deployer);
        console2.log("Liquidation operator         :", liquidationOperator);
    }
}
