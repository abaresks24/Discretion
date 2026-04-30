// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {ERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/token/ERC7984.sol";
import {ERC20ToERC7984Wrapper} from
    "@iexec-nox/nox-confidential-contracts/contracts/token/extensions/ERC20ToERC7984Wrapper.sol";

/// @title DiscretionTokenWrapper
/// @notice Concrete instantiation of Nox's `ERC20ToERC7984Wrapper`. We deploy
///         one of these per non-canonical asset we want to support as
///         confidential collateral (e.g. cWETH on Arbitrum Sepolia).
///         For canonical assets that already have a Nox-deployed wrapper
///         (cRLC, cUSDC) we reuse those — no need for our own.
contract DiscretionTokenWrapper is ERC20ToERC7984Wrapper {
    constructor(IERC20 underlying_, string memory name_, string memory symbol_)
        ERC7984(name_, symbol_, "")
        ERC20ToERC7984Wrapper(underlying_)
    {}
}
