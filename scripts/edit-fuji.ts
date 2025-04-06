//https://pub-7337cfa6ce8741dea70792ea29aa86e7.r2.dev/product_metadata/5507429889059534.json

import { ethers } from "hardhat";
import { registerUpkeep } from "./register-keeper";
import { ProductToken, USDCFundraiserFactory } from "../typechain-types";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying to Fuji with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "AVAX");
    
    const productToken = await ethers.getContractAt("ProductToken", "0x49216924D47184954e25940a6352abc4b03AbAeD") as ProductToken;

    const changeBaseURI = await productToken.setBaseURI("https://pub-7337cfa6ce8741dea70792ea29aa86e7.r2.dev/product_metadata/");
    await changeBaseURI.wait();
    console.log("Base URI changed to: https://pub-7337cfa6ce8741dea70792ea29aa86e7.r2.dev/product_metadata/");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});