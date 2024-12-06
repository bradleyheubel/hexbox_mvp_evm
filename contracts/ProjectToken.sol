// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ProjectToken is ERC20, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address projectCreator
    ) ERC20(name, symbol) Ownable(projectCreator) {
        // Mint 40% of tokens to project creator
        uint256 creatorTokens = (initialSupply * 40) / 100;
        _mint(projectCreator, creatorTokens);
    }

    // Only the campaign contract should be able to mint tokens
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}