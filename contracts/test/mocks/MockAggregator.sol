// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {AggregatorV3Interface} from "../../src/interfaces/AggregatorV3Interface.sol";

/// @dev Minimal Chainlink aggregator mock for tests — NOT used in production, only the
///      test environment. Per CLAUDE.md "no mock data", this is only for unit tests; the
///      deployed oracle wires a real Chainlink feed or the manual override.
contract MockAggregator is AggregatorV3Interface {
    uint8 private _decimals;
    int256 private _answer;
    uint256 private _updatedAt;
    uint80 private _roundId;

    constructor(uint8 decs, int256 answer_) {
        _decimals = decs;
        _answer = answer_;
        _updatedAt = block.timestamp;
        _roundId = 1;
    }

    function setAnswer(int256 answer_) external {
        _answer = answer_;
        _updatedAt = block.timestamp;
        _roundId += 1;
    }

    function setUpdatedAt(uint256 ts) external {
        _updatedAt = ts;
    }

    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (_roundId, _answer, _updatedAt, _updatedAt, _roundId);
    }
}
