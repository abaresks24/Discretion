// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {HybridPriceOracle} from "../src/HybridPriceOracle.sol";
import {ConfidentialLendingVault} from "../src/ConfidentialLendingVault.sol";
import {WrapQueue} from "../src/WrapQueue.sol";
import {UnwrapQueue} from "../src/UnwrapQueue.sol";
import {DiscretionTokenWrapper} from "../src/DiscretionTokenWrapper.sol";

/// @notice End-to-end deploy: oracle, multi-collat vault, cWETH wrapper,
///         RLC wrap-queue (mixer). Registers RLC, WETH, USDC as collateral
///         assets — USDC is also the single debt asset.
contract Deploy is Script {
    struct Cfg {
        address deployer;
        address cUsdc;
        address usdc;
        address cRlc;
        address rlc;
        address weth;
        uint256 priceRlc;
        uint256 priceUsdc;
        uint256 priceWeth;
        uint16 ltvRlc;
        uint16 ltvWeth;
        uint16 ltvUsdc;
    }

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        Cfg memory cfg = _loadCfg(vm.addr(pk));

        vm.startBroadcast(pk);
        Deployed memory d = _deploy(cfg);
        vm.stopBroadcast();

        _log(cfg, d);
    }

    function _loadCfg(address deployer) internal view returns (Cfg memory cfg) {
        cfg.deployer = deployer;
        cfg.cUsdc = vm.envAddress("C_USDC_TOKEN");
        cfg.usdc  = vm.envAddress("USDC_ASSET");
        cfg.cRlc  = vm.envAddress("C_RLC_TOKEN");
        cfg.rlc   = vm.envAddress("RLC_ASSET");
        cfg.weth  = vm.envAddress("WETH_ASSET");
        cfg.priceRlc  = vm.envUint("INITIAL_PRICE_USD_RLC_8DEC");
        cfg.priceUsdc = vm.envUint("INITIAL_PRICE_USD_USDC_8DEC");
        cfg.priceWeth = vm.envUint("INITIAL_PRICE_USD_WETH_8DEC");
        cfg.ltvRlc  = uint16(vm.envUint("LTV_BPS_RLC"));
        cfg.ltvWeth = uint16(vm.envUint("LTV_BPS_WETH"));
        cfg.ltvUsdc = uint16(vm.envUint("LTV_BPS_USDC"));
    }

    struct Deployed {
        HybridPriceOracle oracle;
        ConfidentialLendingVault vault;
        WrapQueue wrapQueue;
        UnwrapQueue unwrapQueue;
        DiscretionTokenWrapper cWeth;
    }

    function _deploy(Cfg memory cfg) internal returns (Deployed memory d) {
        d.oracle = new HybridPriceOracle(cfg.deployer);
        d.oracle.setManualOverride(cfg.rlc,  cfg.priceRlc);
        d.oracle.setManualOverride(cfg.usdc, cfg.priceUsdc);
        d.oracle.setManualOverride(cfg.weth, cfg.priceWeth);

        d.cWeth = new DiscretionTokenWrapper(
            IERC20(cfg.weth),
            "Confidential WETH",
            "cWETH"
        );

        d.vault = new ConfidentialLendingVault(
            address(d.oracle),
            cfg.cUsdc,
            cfg.usdc,
            cfg.deployer
        );

        d.vault.addCollateralAsset(cfg.rlc,  cfg.cRlc,           cfg.ltvRlc);
        d.vault.addCollateralAsset(cfg.weth, address(d.cWeth),   cfg.ltvWeth);
        d.vault.addCollateralAsset(cfg.usdc, cfg.cUsdc,          cfg.ltvUsdc);

        // Liquidation operator = deployer for the hackathon. Production
        // rotates to the TDX iApp publisher wallet via setLiquidationOperator.
        d.vault.setLiquidationOperator(cfg.deployer);

        // Entry mixer (RLC) and exit mixer (cUSDC). Only one of each — the
        // exit mixer targets cUSDC because that is the asset borrowers
        // receive and most likely want to use externally.
        d.wrapQueue = new WrapQueue(cfg.rlc, cfg.cRlc, cfg.deployer);
        d.unwrapQueue = new UnwrapQueue(cfg.usdc, cfg.cUsdc, cfg.deployer);
    }

    function _log(Cfg memory cfg, Deployed memory d) internal pure {
        console2.log("HybridPriceOracle        :", address(d.oracle));
        console2.log("ConfidentialLendingVault :", address(d.vault));
        console2.log("WrapQueue   (RLC entry)  :", address(d.wrapQueue));
        console2.log("UnwrapQueue (USDC exit)  :", address(d.unwrapQueue));
        console2.log("cWETH (our wrapper)      :", address(d.cWeth));
        console2.log("cRLC  (Nox)              :", cfg.cRlc);
        console2.log("cUSDC (Nox)              :", cfg.cUsdc);
        console2.log("--- Collateral registry ---");
        console2.log("RLC  ltv bps:", cfg.ltvRlc);
        console2.log("WETH ltv bps:", cfg.ltvWeth);
        console2.log("USDC ltv bps:", cfg.ltvUsdc);
    }
}
