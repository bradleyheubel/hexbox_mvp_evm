import { ethers } from "hardhat";

async function main() {
    const factoryProxy = await ethers.getContractAt(
        "USDCFundraiserFactoryUpgradeableV2", 
        "0x5a4582cDe5c5DB81C84029f5c340421Bb10B4BE7"
    );
  
    await factoryProxy.updateProductTokenAddress("0xC0095941F79c6C44f6Bbb4Fe92E9612B5f1aD80a"); // ProductToken proxy address
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});