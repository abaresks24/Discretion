// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE} from "../../src/libraries/FHE.sol";
import {IConfidentialToken} from "../../src/interfaces/IConfidentialToken.sol";

/// @dev Test-only ERC-7984 stand-in. Tracks balances as plain uint64 (via FHE placeholder
///      handles) so the vault logic can be exercised before Nox integration. See
///      CLAUDE.md §5.2 — will be replaced with the real Nox token once packages land.
contract MockConfidentialToken is IConfidentialToken {
    using FHE for FHE.euint64;

    mapping(address => uint64) public balances;

    // Mint helper for tests only.
    function mint(address to, uint64 amount) external {
        balances[to] += amount;
    }

    function balanceOfEncrypted(address account) external view override returns (FHE.euint64) {
        return FHE.asEuint64(balances[account]);
    }

    function transferEncrypted(address to, FHE.euint64 encryptedAmount) external override returns (bool) {
        uint64 amount = FHE.asUint64(encryptedAmount);
        require(balances[msg.sender] >= amount, "MCT: insufficient");
        unchecked {
            balances[msg.sender] -= amount;
            balances[to] += amount;
        }
        return true;
    }

    function transferFromEncrypted(address from, address to, FHE.euint64 encryptedAmount)
        external
        override
        returns (bool)
    {
        uint64 amount = FHE.asUint64(encryptedAmount);
        require(balances[from] >= amount, "MCT: insufficient");
        unchecked {
            balances[from] -= amount;
            balances[to] += amount;
        }
        return true;
    }
}
