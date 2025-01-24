import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying factory with account:", deployer.address);

    const Factory = await ethers.getContractFactory("USDCFundraiserFactory");
    const factory = await Factory.deploy(
        "0x5425890298aed601595a70AB815c96711a31Bc65", // FUJI_USDC
        "0x535AcaB2100261f8d2A7C3BBdaE7BA7F340eD9fB", // ProductToken
        "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846", // LINK
        "0xD23D3D1b81711D75E1012211f1b65Cc7dBB474e2", // Registrar
        "0x819B58A646CDd8289275A87653a2aA4902b14fe6", // Registry
        "0x3f678e11" // registerUpkeepSelector
    );

    await factory.waitForDeployment();
    console.log("Factory deployed to:", await factory.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 