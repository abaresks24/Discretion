// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IHybridPriceOracle
/// @notice Price oracle that serves Chainlink feeds by default and allows an owner-controlled
///         manual override per asset for deterministic testnet demos. See CLAUDE.md §6.
/// @dev Prices are returned in 8 decimals, matching Chainlink USD feed conventions.
interface IHybridPriceOracle {
    // -- events --
    event FeedSet(address indexed asset, address indexed feed);
    event ManualOverrideSet(address indexed asset, uint256 price);
    event ManualOverrideCleared(address indexed asset);

    // -- reads --
    function getPrice(address asset) external view returns (uint256 price, uint256 updatedAt);
    function isOverridden(address asset) external view returns (bool);

    // -- writes (owner-only) --
    function setFeed(address asset, address feed) external;
    function setManualOverride(address asset, uint256 price) external;
    function clearManualOverride(address asset) external;
}
