// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FHE (placeholder)
/// @notice Placeholder library for encrypted arithmetic. The type surface and function names
///         mirror the idioms of the Zama fhEVM / iExec Nox TFHE library so that swapping the
///         internals in Day 2 is a mechanical find-replace.
/// @dev    The placeholder is NOT confidential — each ciphertext is just the plaintext value
///         stored in a bytes32 handle. It exists so that the rest of the contract graph
///         (access control, events, oracle wiring, liquidation logic, tests) can be built
///         today, ahead of the April 17 Nox workshop.
///
///         FIXME(nox): after the workshop, replace each function body with the real TFHE /
///         Nox operation (`TFHE.add`, `TFHE.sub`, `TFHE.lt`, `TFHE.select`, etc.) and audit
///         every call site for new ACL / permission requirements. See CLAUDE.md §5.2.
library FHE {
    type euint64 is bytes32;
    type ebool is bytes32;

    // -------------------------------------------------------------------------
    // Conversions (will become either `TFHE.asEuint64` or verified input handles)
    // -------------------------------------------------------------------------

    function asEuint64(uint64 v) internal pure returns (euint64) {
        return euint64.wrap(bytes32(uint256(v)));
    }

    function asUint64(euint64 v) internal pure returns (uint64) {
        // FIXME(nox): on real ciphertexts this is not possible without a gateway round-trip.
        //             Tests use this; production code must route through a Gateway callback.
        return uint64(uint256(euint64.unwrap(v)));
    }

    function isSet(euint64 v) internal pure returns (bool) {
        return euint64.unwrap(v) != bytes32(0);
    }

    function zero() internal pure returns (euint64) {
        return euint64.wrap(bytes32(0));
    }

    // -------------------------------------------------------------------------
    // Arithmetic
    // -------------------------------------------------------------------------

    // NB (placeholder semantics): we store plaintext in the full 256 bits of the
    // handle so intermediate LTV math can exceed uint64.max without failing. The
    // real Nox TFHE library enforces the 64-bit ceiling — the `_ltvBps` FIXME in
    // ConfidentialLendingVault.sol already tracks the required cross-multiplication
    // rewrite for Day 2.

    function add(euint64 a, euint64 b) internal pure returns (euint64) {
        uint256 r = uint256(euint64.unwrap(a)) + uint256(euint64.unwrap(b));
        return euint64.wrap(bytes32(r));
    }

    function sub(euint64 a, euint64 b) internal pure returns (euint64) {
        uint256 av = uint256(euint64.unwrap(a));
        uint256 bv = uint256(euint64.unwrap(b));
        // FIXME(nox): real TFHE.sub underflow semantics differ — confirm behaviour.
        require(av >= bv, "FHE: underflow");
        return euint64.wrap(bytes32(av - bv));
    }

    /// @dev Scalar multiply — scalar is plaintext (public). Cheaper than encrypted*encrypted.
    function mulScalar(euint64 a, uint64 scalar) internal pure returns (euint64) {
        uint256 r = uint256(euint64.unwrap(a)) * uint256(scalar);
        return euint64.wrap(bytes32(r));
    }

    /// @dev Scalar divide — scalar is plaintext (public).
    function divScalar(euint64 a, uint64 scalar) internal pure returns (euint64) {
        require(scalar != 0, "FHE: div by zero");
        return euint64.wrap(bytes32(uint256(euint64.unwrap(a)) / uint256(scalar)));
    }

    // -------------------------------------------------------------------------
    // Comparisons (return ebool — in real Nox this is a ciphertext)
    // -------------------------------------------------------------------------

    function lt(euint64 a, euint64 b) internal pure returns (ebool) {
        return _packBool(uint256(euint64.unwrap(a)) < uint256(euint64.unwrap(b)));
    }

    function lte(euint64 a, euint64 b) internal pure returns (ebool) {
        return _packBool(uint256(euint64.unwrap(a)) <= uint256(euint64.unwrap(b)));
    }

    function gt(euint64 a, euint64 b) internal pure returns (ebool) {
        return _packBool(uint256(euint64.unwrap(a)) > uint256(euint64.unwrap(b)));
    }

    function gte(euint64 a, euint64 b) internal pure returns (ebool) {
        return _packBool(uint256(euint64.unwrap(a)) >= uint256(euint64.unwrap(b)));
    }

    function eq(euint64 a, euint64 b) internal pure returns (ebool) {
        return _packBool(euint64.unwrap(a) == euint64.unwrap(b));
    }

    // -------------------------------------------------------------------------
    // Conditional select — the FHE-safe way to branch
    // -------------------------------------------------------------------------

    /// @notice Returns `a` if `cond` is true, else `b`. On real TFHE this is done purely on
    ///         ciphertexts so control flow leaks nothing.
    function select(ebool cond, euint64 a, euint64 b) internal pure returns (euint64) {
        return _unpackBool(cond) ? a : b;
    }

    /// @notice Decrypts an ebool. In production this requires a gateway round-trip and the
    ///         caller must have been granted ACL permission; here it's a local unpack.
    /// @dev FIXME(nox): replace with `TFHE.decrypt(ebool)` or Gateway async callback.
    function revealBool(ebool cond) internal pure returns (bool) {
        return _unpackBool(cond);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _packBool(bool v) private pure returns (ebool) {
        return ebool.wrap(bytes32(uint256(v ? 1 : 0)));
    }

    function _unpackBool(ebool v) private pure returns (bool) {
        return uint256(ebool.unwrap(v)) != 0;
    }
}
