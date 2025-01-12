 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IAutomationRegistrar {
    function register(
        string memory name,
        bytes memory encryptedEmail,
        address upkeepContract,
        uint32 gasLimit,
        address adminAddress,
        uint8 triggerType,
        bytes memory checkData,
        bytes memory triggerConfig,
        bytes memory offchainConfig,
        uint96 amount,
        address sender
    ) external;

    function onTokenTransfer(
        address sender,
        uint256 amount,
        bytes calldata data
    ) external returns (bool);
}