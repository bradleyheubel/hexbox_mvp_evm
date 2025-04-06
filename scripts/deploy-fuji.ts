import { ethers } from "hardhat";
import { registerUpkeep } from "./register-keeper";
import { ProductToken, USDCFundraiserFactory } from "../typechain-types";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying to Fuji with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "AVAX");

    try {
        // Deploy ProductToken
        // console.log("\nDeploying ProductToken...");
        // const ProductToken = await ethers.getContractFactory("ProductToken");
        // const deployedProductToken = await ProductToken.deploy(
        //     "https://pub-7337cfa6ce8741dea70792ea29aa86e7.r2.dev/products_metadata/"
        // );
        // await deployedProductToken.waitForDeployment();
        // console.log("ProductToken deployed to:", await deployedProductToken.getAddress());

        // Reference ProductToken
        const PRODUCT_TOKEN_ADDRESS = "0x49216924D47184954e25940a6352abc4b03AbAeD" //await deployedProductToken.getAddress();
        const productToken = await ethers.getContractAt("ProductToken", PRODUCT_TOKEN_ADDRESS) as ProductToken;

        const FUJI_USDC = "0x5425890298aed601595a70AB815c96711a31Bc65";
        const LINK_TOKEN = "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846";
        const CHAINLINK_REGISTRAR = "0xD23D3D1b81711D75E1012211f1b65Cc7dBB474e2";
        const CHAINLINK_REGISTRY = "0x819B58A646CDd8289275A87653a2aA4902b14fe6";
        const REGISTER_UPKEEP_SELECTOR = "0x3f678e11";

        // Deploy USDCFundraiserFactory
        console.log("\nDeploying USDCFundraiserFactory...");
        const USDCFundraiserFactory = await ethers.getContractFactory("USDCFundraiserFactory");
        
        const deployedFactory = await USDCFundraiserFactory.deploy(
            FUJI_USDC,
            PRODUCT_TOKEN_ADDRESS,
            LINK_TOKEN,
            CHAINLINK_REGISTRAR,
            CHAINLINK_REGISTRY,
            REGISTER_UPKEEP_SELECTOR
        );
        await deployedFactory.waitForDeployment();
        console.log("USDCFundraiserFactory deployed to:", await deployedFactory.getAddress());

        const FACTORY_ADDRESS = await deployedFactory.getAddress(); //"0x2BC4F4757c5dDd37409B5d3D90811BBb652a96C4"; //"0x36e68c8910d424730d96f5C405371fAb86bB5682";
        const factory = await ethers.getContractAt("USDCFundraiserFactory", FACTORY_ADDRESS);

        // Deploy USDCFundraiser
        console.log("\nDeploying USDCFundraiser...");
        const fundingType = 0; // 0 = all or nothing, 1 = limitless, 2 = flexible
        const thirtyMinutes = 30 * 60;
        const deadline = Math.floor(Date.now() / 1000) + thirtyMinutes;
        const minimumTarget = 10_000000n; // 10 USDC
        const feeWallet = "0xf736851ECC29b787eA815262A3a3B76B45da58Be";
        const beneficiaryWallet = "0xDf839d46E8b2fA648DB995A2DA1405aF0982cb76";

        // // Define initial products
        // const productIds = [1, 5];
        // const productPrices = [2_000000n, 1_000000n]; // 1 USDC, 2 USDC
        // const productSupplyLimits = [100, 100];

        const products = [
            {
                productId: 9837413n,
                price: 1_000000n,     // 1 USDC
                supplyLimit: 100n     // Limited to 100
            },
            {
                productId: 7823310n,
                price: 2_000000n,     // 2 USDC
                supplyLimit: 0n       // Unlimited supply
            },
            {
                productId: 6453789n,
                price: 3_000000n,     // 3 USDC
                supplyLimit: 200n     // Limited to 200
            }
        ];

        // // Check factory's LINK balance
        // const linkToken = await ethers.getContractAt("IERC20", LINK_TOKEN);
        // const factoryLinkBalance = await linkToken.balanceOf(FACTORY_ADDRESS);
        // console.log("Factory LINK balance:", ethers.formatEther(factoryLinkBalance));

        // // Transfer LINK to factory if needed
        // if (factoryLinkBalance < ethers.parseEther("1")) {
        //     console.log("Transferring LINK to factory...");
        //     const tx = await linkToken.transfer(FACTORY_ADDRESS, ethers.parseEther("1"));
        //     await tx.wait();

        //     console.log("New factory LINK balance:", 
        //         ethers.formatEther(await linkToken.balanceOf(FACTORY_ADDRESS))
        //     );
        // }

            const fundraiserTx = await factory.createFundraiser(
                beneficiaryWallet,
                feeWallet,
                fundingType,
                minimumTarget,
                deadline,
                products,
                { gasLimit: 5000000 } // Increase gas limit significantly
            );
            console.log("Fundraiser tx sent:", fundraiserTx.hash);

            const receipt = await fundraiserTx.wait();
            console.log("Fundraiser tx receipt: ", receipt);
            const event = factory.interface.parseLog(receipt!.logs[0]);
            let fundraiserAddress = "";
            // console.log("---- loop ---")
            receipt!.logs.forEach(log => {
                //console.log(factory.interface.parseLog(log));
                if (factory.interface.parseLog(log)?.name == "FundraiserCreated") {
                    fundraiserAddress = factory.interface.parseLog(log)?.args[0];
                    console.log("Fundraiser deployed to:", fundraiserAddress);
                }
            })
            
            const fundraiser = await ethers.getContractAt("USDCFundraiser", fundraiserAddress);
            // const upkeepId = await fundraiser.getStationUpkeepID();
            // console.log("Upkeep ID:", upkeepId);
        


        // const USDCFundraiser = await ethers.getContractFactory("USDCFundraiser");
        // const fundraiser = await USDCFundraiser.deploy(
        //     FUJI_USDC,
        //     beneficiaryWallet,
        //     feeWallet,
        //     fundingType,
        //     minimumTarget,
        //     deadline,
        //     true,
        //     await productToken.getAddress(),
        //     productIds,
        //     productPrices,
        //     LINK_TOKEN,
        //     CHAINLINK_REGISTRAR,
        //     CHAINLINK_REGISTRY,
        //     REGISTER_UPKEEP_SELECTOR
        // );
        // await fundraiser.waitForDeployment();
        // console.log("USDCFundraiser deployed to:", await fundraiser.getAddress());

        // // Register Chainlink Upkeep
        // console.log("\nRegistering Chainlink Upkeep...");
        // await registerUpkeep(await fundraiser.getAddress());

        // Grant MINTER_ROLE to fundraiser
        console.log("\nGranting MINTER_ROLE to fundraiser...");
        const grantRole = await productToken.grantRole(
            await productToken.MINTER_ROLE(),
            fundraiserAddress
        );
        await grantRole.wait();
        console.log("MINTER_ROLE granted to fundraiser");

        // Log all deployment information
        console.log("\nDeployment Summary:");
        console.log("--------------------");
        console.log("Network: Avalanche Fuji Testnet");
        console.log("USDC Address:", FUJI_USDC);
        console.log("ProductToken:", PRODUCT_TOKEN_ADDRESS);
        console.log("USDCFundraiser:", fundraiserAddress);
        console.log("Deployer:", deployer.address);
        console.log("Funding Type:", fundingType);
        console.log("Deadline:", new Date(deadline * 1000).toLocaleString());
        console.log("Minimum Target:", ethers.formatUnits(minimumTarget, 6), "USDC");
        console.log("Products:", products);

        if (fundingType != 1) {

            const fundraiser = await ethers.getContractAt("USDCFundraiser", fundraiserAddress);

            // const tx = await fundraiser.connect(deployer).updateFeePercentage(10);
            // await tx.wait();
            // console.log("Fee updated to 10 ", tx.hash);


            //const fundraiserAddress = await fundraiser.getAddress();
            // After deployment, fund with LINK and register
                
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
                    const estimatedGas = await fundraiser.initializeChainlink.estimateGas(
                        registrationParams
                    );
                    const gasLimit = estimatedGas * 105n / 100n;
                    console.log("Estimated gas:", estimatedGas);
                    console.log("Gas limit:", gasLimit);
                    const tx = await fundraiser.initializeChainlink(
                        registrationParams,
                        {
                            gasLimit: gasLimit
                        }
                    )
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