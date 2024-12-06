// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, 1000000 * 10**6); // Mint 1M USDC to deployer
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    // USDC uses 6 decimals
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}