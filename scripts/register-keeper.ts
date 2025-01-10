import { ethers } from "hardhat";

async function registerUpkeep(fundraiserAddress: string) {
    // Fuji Automation addresses
    const REGISTRAR_ADDRESS = "0xD23D3D1b81711D75E1012211f1b65Cc7dBB474e2";
    const LINK_TOKEN = "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846";
    
    // Get the LINK token contract
    const linkToken = await ethers.getContractAt("IERC20", LINK_TOKEN);
    
    // Get the registrar contract
    const registrar = await ethers.getContractAt(
        "IAutomationRegistrar",
        REGISTRAR_ADDRESS
    );

    // Registration parameters
    const params = {
        name: "USDCFundraiser Automation",
        encryptedEmail: "0x",
        upkeepContract: fundraiserAddress,
        gasLimit: 500000,
        adminAddress: await (await ethers.getSigners())[0].getAddress(),
        checkData: "0x",
        amount: ethers.parseEther("5"), // LINK tokens for funding
        source: 0
    };

    // Approve LINK transfer
    await linkToken.approve(REGISTRAR_ADDRESS, params.amount);

    console.log("Registering upkeep for contract:", fundraiserAddress);
    
    // Register upkeep through the registrar
    const tx = await registrar.register(
        params.name,
        params.encryptedEmail,
        params.upkeepContract,
        params.gasLimit,
        params.adminAddress,
        params.checkData,
        params.amount,
        params.source,
        { gasLimit: 1000000 } // Explicitly set gas limit for the transaction
    );

    const receipt = await tx.wait();
    console.log("Upkeep registration tx:", receipt?.hash);

    return receipt;
}

export { registerUpkeep };