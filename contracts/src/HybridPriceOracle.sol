// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHybridPriceOracle} from "./interfaces/IHybridPriceOracle.sol";
import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";

/// @title HybridPriceOracle
/// @notice Serves asset prices from a Chainlink aggregator by default and lets the owner set
///         a manual override for testnet demos. Outputs are normalised to 8 decimals, matching
///         Chainlink USD feed convention.
/// @dev    On mainnet this contract would ship without the override paths (or with them gated
///         by a timelocked multisig). See CLAUDE.md §6 for the rationale.
contract HybridPriceOracle is IHybridPriceOracle {
    uint8 public constant PRICE_DECIMALS = 8;
    uint256 public constant STALENESS_THRESHOLD = 1 hours;

    address public owner;

    struct FeedConfig {
        AggregatorV3Interface feed; // Chainlink aggregator (may be zero if only override is used)
        uint8 feedDecimals;         // cached for gas
    }

    mapping(address => FeedConfig) private _feeds;

    struct Override {
        bool active;
        uint256 price;    // in PRICE_DECIMALS
        uint256 setAt;
    }

    mapping(address => Override) private _overrides;

    // -- errors --
    error NotOwner();
    error FeedNotSet(address asset);
    error FeedStale(address asset, uint256 updatedAt);
    error FeedNegative(address asset, int256 answer);
    error ZeroPrice();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _owner) {
        owner = _owner == address(0) ? msg.sender : _owner;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    function setFeed(address asset, address feed) external onlyOwner {
        AggregatorV3Interface agg = AggregatorV3Interface(feed);
        _feeds[asset] = FeedConfig({
            feed: agg,
            feedDecimals: feed == address(0) ? 0 : agg.decimals()
        });
        emit FeedSet(asset, feed);
    }

    function setManualOverride(address asset, uint256 price) external onlyOwner {
        if (price == 0) revert ZeroPrice();
        _overrides[asset] = Override({active: true, price: price, setAt: block.timestamp});
        emit ManualOverrideSet(asset, price);
    }

    function clearManualOverride(address asset) external onlyOwner {
        delete _overrides[asset];
        emit ManualOverrideCleared(asset);
    }

    // -------------------------------------------------------------------------
    // Reads
    // -------------------------------------------------------------------------

    function getPrice(address asset) external view returns (uint256 price, uint256 updatedAt) {
        Override memory o = _overrides[asset];
        if (o.active) {
            return (o.price, o.setAt);
        }

        FeedConfig memory cfg = _feeds[asset];
        if (address(cfg.feed) == address(0)) revert FeedNotSet(asset);

        (, int256 answer, , uint256 ts, ) = cfg.feed.latestRoundData();
        if (answer <= 0) revert FeedNegative(asset, answer);
        if (block.timestamp > ts + STALENESS_THRESHOLD) revert FeedStale(asset, ts);

        price = _normaliseDecimals(uint256(answer), cfg.feedDecimals, PRICE_DECIMALS);
        updatedAt = ts;
    }

    function isOverridden(address asset) external view returns (bool) {
        return _overrides[asset].active;
    }

    function feedOf(address asset) external view returns (address) {
        return address(_feeds[asset].feed);
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    function _normaliseDecimals(uint256 v, uint8 from, uint8 to) private pure returns (uint256) {
        if (from == to) return v;
        if (from < to) return v * (10 ** (to - from));
        return v / (10 ** (from - to));
    }
}
