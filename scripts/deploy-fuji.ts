import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying to Fuji with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "AVAX");

    try {
        // Deploy ProductToken
        console.log("\nDeploying ProductToken...");
        const ProductToken = await ethers.getContractFactory("ProductToken");
        const productToken = await ProductToken.deploy("https://pub-7337cfa6ce8741dea70792ea29aa86e7.r2.dev/campaign_products/metadata/");
        await productToken.waitForDeployment();
        console.log("ProductToken deployed to:", await productToken.getAddress());

        // Deploy USDCFundraiser
        console.log("\nDeploying USDCFundraiser...");
        const FUJI_USDC = "0x5425890298aed601595a70AB815c96711a31Bc65";
        const thirtyMinutes = 30 * 60;
        const deadline = Math.floor(Date.now() / 1000) + thirtyMinutes;
        const minimumTarget = 5_000000n; // 5 USDC
        const feeWallet = "0xf736851ECC29b787eA815262A3a3B76B45da58Be";
        const beneficiaryWallet = "0xDf839d46E8b2fA648DB995A2DA1405aF0982cb76";

        // Define initial products
        const productIds = [1, 2];
        const productPrices = [1_000000n, 2_000000n]; // 1 USDC, 2 USDC

        const USDCFundraiser = await ethers.getContractFactory("USDCFundraiser");
        const fundraiser = await USDCFundraiser.deploy(
            FUJI_USDC,
            beneficiaryWallet,
            feeWallet,
            minimumTarget,
            deadline,
            true,
            await productToken.getAddress(),
            productIds,
            productPrices
        );
        await fundraiser.waitForDeployment();
        console.log("USDCFundraiser deployed to:", await fundraiser.getAddress());

        // Grant MINTER_ROLE to fundraiser
        console.log("\nGranting MINTER_ROLE to fundraiser...");
        const grantRole = await productToken.grantRole(
            await productToken.MINTER_ROLE(),
            await fundraiser.getAddress()
        );
        await grantRole.wait();
        console.log("MINTER_ROLE granted to fundraiser");

        // Log all deployment information
        console.log("\nDeployment Summary:");
        console.log("--------------------");
        console.log("Network: Avalanche Fuji Testnet");
        console.log("USDC Address:", FUJI_USDC);
        console.log("ProductToken:", await productToken.getAddress());
        console.log("USDCFundraiser:", await fundraiser.getAddress());
        console.log("Deployer:", deployer.address);
        console.log("Deadline:", new Date(deadline * 1000).toLocaleString());
        console.log("Minimum Target:", ethers.formatUnits(minimumTarget, 6), "USDC");

    } catch (error) {
        console.error("Error during deployment:", error);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 