import { ethers } from "hardhat";
import { registerUpkeep } from "./register-keeper";

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
            productPrices,
            ethers.ZeroAddress,  // Use default LINK address
            ethers.ZeroAddress   // Use default Registrar address
        );
        await fundraiser.waitForDeployment();
        console.log("USDCFundraiser deployed to:", await fundraiser.getAddress());

        // // Register Chainlink Upkeep
        // console.log("\nRegistering Chainlink Upkeep...");
        // await registerUpkeep(await fundraiser.getAddress());

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

        // After deployment, fund with LINK and register
        const LINK_TOKEN = "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846";
        
        // Use explicit IERC20 ABI
        const IERC20_ABI = [
            "function balanceOf(address owner) view returns (uint256)",
            "function transfer(address to, uint256 value) returns (bool)"
        ];
        const linkToken = new ethers.Contract(LINK_TOKEN, IERC20_ABI, deployer);

        try {
            // Check LINK balance
            const linkBalance = await linkToken.balanceOf(deployer.address);
            console.log("Deployer LINK balance:", ethers.formatEther(linkBalance));

            if (linkBalance < ethers.parseEther("5")) {
                throw new Error("Insufficient LINK tokens. Get some from https://faucets.chain.link/fuji");
            }

            // Transfer LINK to contract
            console.log("Transferring LINK to contract...");
            const transferTx = await linkToken.transfer(
                await fundraiser.getAddress(),
                ethers.parseEther("1")
            );
            await transferTx.wait();
            
            // Verify LINK transfer
            const contractLinkBalance = await linkToken.balanceOf(await fundraiser.getAddress());
            console.log("Contract LINK balance:", ethers.formatEther(contractLinkBalance));

            // Register with Chainlink
            console.log("Registering with Chainlink...");
            try {
                const tx = await fundraiser.registerWithChainlink({
                    gasLimit: 3000000
                });
                console.log("Registration tx sent:", tx.hash);
                
                const receipt = await tx.wait(2);
                console.log("Transaction status:", receipt?.status);
                
                // Check for events
                if (receipt?.logs) {
                    for (const log of receipt.logs) {
                        try {
                            const decodedLog = fundraiser.interface.parseLog(log);
                            if (decodedLog) {
                                console.log("Event:", decodedLog.name, decodedLog.args);
                            }
                        } catch (e) {
                            // Skip logs that can't be decoded
                        }
                    }
                }
            } catch (error: any) {
                console.error("Registration failed:", error.message);
                throw error;
            }

        } catch (error) {
            console.error("Error during deployment:", error);
            throw error;
        }

    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 