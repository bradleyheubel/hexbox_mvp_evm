import { ethers } from "hardhat";

async function main() {
    const newURI = "https://pub-7337cfa6ce8741dea70792ea29aa86e7.r2.dev/product_metadata/"

    const productToken = await ethers.getContractAt(
        "ProductTokenUpgradeable", 
        "0xC0095941F79c6C44f6Bbb4Fe92E9612B5f1aD80a"
    );
  
    await productToken.setBaseURI(newURI);
    console.log("Base URI updated to: " + newURI);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});