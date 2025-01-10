// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract MockAutomationRegistrar {
    event RegistrationRequested(
        string name,
        bytes encryptedEmail,
        address upkeepContract,
        uint32 gasLimit,
        address adminAddress,
        bytes checkData,
        uint96 amount,
        uint8 source
    );

    function register(
        string memory name,
        bytes memory encryptedEmail,
        address upkeepContract,
        uint32 gasLimit,
        address adminAddress,
        bytes memory checkData,
        uint96 amount,
        uint8 source
    ) external returns (bool) {
        emit RegistrationRequested(
            name,
            encryptedEmail,
            upkeepContract,
            gasLimit,
            adminAddress,
            checkData,
            amount,
            source
        );
        return true;
    }
} 