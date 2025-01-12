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
        const fundingType = 1; // 0 = all or nothing, 1 = limitless, 2 = flexible
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
            fundingType,
            minimumTarget,
            deadline,
            true,
            await productToken.getAddress(),
            productIds,
            productPrices,
            "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846",  // Use default LINK address
            "0xD23D3D1b81711D75E1012211f1b65Cc7dBB474e2",   // Use default Registrar address
            "0x819B58A646CDd8289275A87653a2aA4902b14fe6",    // Use default Registry address
            "0x3f678e11" // registerUpkeepSelector
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
        console.log("Funding Type:", fundingType);
        console.log("Deadline:", new Date(deadline * 1000).toLocaleString());
        console.log("Minimum Target:", ethers.formatUnits(minimumTarget, 6), "USDC");

        if (fundingType != 1) {
            // After deployment, fund with LINK and register
            const LINK_TOKEN = "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846";
                
            const linkToken = await ethers.getContractAt("IERC20", LINK_TOKEN);

            try {
                // Check LINK balance
                const linkBalance = await linkToken.balanceOf(deployer.address);
                console.log("Deployer LINK balance:", ethers.formatEther(linkBalance));

                if (linkBalance < ethers.parseEther("1")) {
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
                const fundraiserAddress = await fundraiser.getAddress();
                console.log("Fundraiser address:", fundraiserAddress);
                console.log("Deployer address:", deployer.address);
                try {
                    const registrationParams = ethers.AbiCoder.defaultAbiCoder().encode(
                        ["tuple(string,bytes,address,uint32,address,uint8,bytes,bytes,bytes,uint96)"],
                        [
                            [
                                "testing",
                                "0x",
                                fundraiserAddress,
                                300000,
                                deployer.address,
                                0,
                                "0x",
                                "0x",
                                "0x",
                                1000000000000000000n // 1 LINK
                            ],
                        ],
                    )
                    const tx = await fundraiser.initializeChainlink(
                        registrationParams,
                        {
                            gasLimit: 3000000
                        }
                    );
                    console.log("Registration tx sent:", tx.hash);
                    
                    const receipt = await tx.wait(2);
                    console.log("Transaction status:", receipt?.status);
                    console.log("Upkeep ID:", await fundraiser.getStationUpkeepID());
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
        } else {
            console.log("Funding Type is limitless, skipping LINK transfer and Chainlink registration");
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