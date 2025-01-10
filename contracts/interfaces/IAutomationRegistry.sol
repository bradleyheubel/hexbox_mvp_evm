 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IAutomationRegistry {
    function register(
        string memory name,
        bytes memory encryptedEmail,
        address upkeepContract,
        uint32 gasLimit,
        address adminAddress,
        bytes memory checkData,
        uint96 amount,
        uint8 source
    ) external;

    function getUpkeep(uint256 id) external view returns (
        address target,
        uint32 executeGas,
        bytes memory checkData,
        uint96 balance,
        address lastKeeper,
        address admin,
        uint64 maxValidBlocknumber,
        uint96 amountSpent,
        bool paused,
        bytes memory offchainConfig
    );

    function cancelUpkeep(uint256 id) external;
    function withdrawFunds(uint256 id, address to) external;
}