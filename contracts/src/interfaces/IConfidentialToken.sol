// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE} from "../libraries/FHE.sol";

/// @title IConfidentialToken
/// @notice Minimal ERC-7984 surface we rely on for the vault. Exact function signatures
///         will be aligned with iExec Nox's ERC-7984 library once the April 17 workshop
///         confirms them (see CLAUDE.md §15 Q1).
/// @dev FIXME(nox): verify that Nox's ERC-7984 exposes encrypted transferFrom that accepts
///      a handle produced off-chain (input ciphertext + proof), and that balanceOf returns
///      an euint64 handle the caller is permitted to read.
interface IConfidentialToken {
    /// @notice Transfer an encrypted amount from `from` to `to`.
    /// @dev Caller must have been granted an allowance on `from` for this amount.
    function transferFromEncrypted(
        address from,
        address to,
        FHE.euint64 encryptedAmount
    ) external returns (bool);

    /// @notice Transfer an encrypted amount from caller to `to`.
    function transferEncrypted(
        address to,
        FHE.euint64 encryptedAmount
    ) external returns (bool);

    /// @notice Returns a handle to the encrypted balance of `account`.
    /// @dev Caller must have an ACL permission over this ciphertext to actually decrypt.
    function balanceOfEncrypted(address account) external view returns (FHE.euint64);
}
