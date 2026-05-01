// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import {WrapQueue} from "../src/WrapQueue.sol";

/// @notice Deploy entry mixers (WrapQueue) for WETH and USDC, mirroring the
///         existing RLC mixer. Reads the underlying + cToken pairs from env;
///         operator defaults to the deployer (rotated later via setOperator).
contract DeployExtraQueues is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);

        address weth   = vm.envAddress("WETH_ASSET");
        address cWeth  = vm.envAddress("C_WETH_TOKEN");
        address usdc   = vm.envAddress("USDC_ASSET");
        address cUsdc  = vm.envAddress("C_USDC_TOKEN");

        vm.startBroadcast(pk);
        WrapQueue wrapWeth = new WrapQueue(weth, cWeth, deployer);
        WrapQueue wrapUsdc = new WrapQueue(usdc, cUsdc, deployer);
        vm.stopBroadcast();

        console2.log("WrapQueue (WETH entry) :", address(wrapWeth));
        console2.log("WrapQueue (USDC entry) :", address(wrapUsdc));
    }
}
