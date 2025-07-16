const { ethers, upgrades } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

    // Configuration parameters - UPDATE THESE FOR YOUR DEPLOYMENT
    const USDC_ADDRESS = "0xA0b86a33E6441b7c18c75A0B2B0A8b4f1b1e4a9D"; // Replace with actual USDC address
    const PRODUCT_TOKEN_ADDRESS = "0xB1b86a33E6441b7c18c75A0B2B0A8b4f1b1e4a9E"; // Replace with actual ProductToken address
    const DEFAULT_FEE_PERCENTAGE = 250; // 2.5%
    const FEE_WALLET = "0xC2c86a33E6441b7c18c75A0B2B0A8b4f1b1e4a9F"; // Replace with actual fee wallet

    console.log("\n=== Deploying USDCFundraiserUpgradeable Implementation ===");
    
    // Deploy the implementation contract for USDCFundraiser (no proxy needed as it's used as template)
    const USDCFundraiserUpgradeable = await ethers.getContractFactory("USDCFundraiserUpgradeable");
    const fundraiserImplementation = await USDCFundraiserUpgradeable.deploy();
    await fundraiserImplementation.waitForDeployment();
    
    console.log("USDCFundraiser Implementation deployed to:", await fundraiserImplementation.getAddress());

    console.log("\n=== Deploying USDCFundraiserFactoryUpgradeable with UUPS Proxy ===");
    
    // Deploy the factory with UUPS proxy
    const USDCFundraiserFactoryUpgradeable = await ethers.getContractFactory("USDCFundraiserFactoryUpgradeable");
    
    const factoryProxy = await upgrades.deployProxy(
        USDCFundraiserFactoryUpgradeable,
        [
            USDC_ADDRESS,
            PRODUCT_TOKEN_ADDRESS,
            DEFAULT_FEE_PERCENTAGE,
            FEE_WALLET,
            await fundraiserImplementation.getAddress(),
            deployer.address // Initial owner
        ],
        {
            kind: 'uups',
            initializer: 'initialize'
        }
    );
    
    await factoryProxy.waitForDeployment();
    
    console.log("Factory Proxy deployed to:", await factoryProxy.getAddress());
    console.log("Factory Implementation deployed to:", await upgrades.erc1967.getImplementationAddress(await factoryProxy.getAddress()));

    console.log("\n=== Deployment Summary ===");
    console.log("USDCFundraiser Implementation:", await fundraiserImplementation.getAddress());
    console.log("Factory Proxy Address:", await factoryProxy.getAddress());
    console.log("Factory Implementation Address:", await upgrades.erc1967.getImplementationAddress(await factoryProxy.getAddress()));
    
    console.log("\n=== Verification Commands ===");
    console.log("Verify USDCFundraiser Implementation:");
    console.log(`npx hardhat verify --network <network> ${await fundraiserImplementation.getAddress()}`);
    
    console.log("\nVerify Factory Implementation:");
    console.log(`npx hardhat verify --network <network> ${await upgrades.erc1967.getImplementationAddress(await factoryProxy.getAddress())}`);

    // Save deployment addresses to file
    const fs = require('fs');
    const deploymentInfo = {
        network: (await ethers.provider.getNetwork()).name,
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        addresses: {
            fundraiserImplementation: await fundraiserImplementation.getAddress(),
            factoryProxy: await factoryProxy.getAddress(),
            factoryImplementation: await upgrades.erc1967.getImplementationAddress(await factoryProxy.getAddress())
        },
        config: {
            usdcAddress: USDC_ADDRESS,
            productTokenAddress: PRODUCT_TOKEN_ADDRESS,
            defaultFeePercentage: DEFAULT_FEE_PERCENTAGE,
            feeWallet: FEE_WALLET
        }
    };

    fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
    console.log("\nDeployment info saved to deployment-info.json");

    return {
        fundraiserImplementation: await fundraiserImplementation.getAddress(),
        factoryProxy: await factoryProxy.getAddress()
    };
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = main;
