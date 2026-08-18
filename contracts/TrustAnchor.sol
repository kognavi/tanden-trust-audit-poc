// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract TrustAnchor {
    mapping(bytes32 => uint256) public anchoredAt;

    event Anchored(bytes32 indexed hash, uint256 timestamp);

    function anchor(bytes32 hash) external {
        require(anchoredAt[hash] == 0, "Already anchored");
        anchoredAt[hash] = block.timestamp;
        emit Anchored(hash, block.timestamp);
    }
}
