import { ethers, upgrades } from "hardhat";
import fs from "fs";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    // Configuration parameters - UPDATE THESE FOR YOUR DEPLOYMENT
    const USDC_ADDRESS = "0x5425890298aed601595a70AB815c96711a31Bc65"; 
    const PRODUCT_TOKEN_ADDRESS = "0x49216924D47184954e25940a6352abc4b03AbAeD"; 
    const DEFAULT_FEE_PERCENTAGE = 250; // 2.5%
    const FEE_WALLET = "0xB60c975cC83168C298EfE5334A110DA33618B48d"; 

    console.log("\n=== Deploying USDCFundraiserUpgradeable Implementation ===");
    
    // Deploy the implementation contract for USDCFundraiser (no proxy needed as it's used as template)
    const USDCFundraiserUpgradeable = await ethers.getContractFactory("USDCFundraiserUpgradeable");
    const fundraiserImplementation = await USDCFundraiserUpgradeable.deploy();
    await fundraiserImplementation.waitForDeployment();
    
    const fundraiserImplementationAddress = await fundraiserImplementation.getAddress();
    console.log("USDCFundraiser Implementation deployed to:", fundraiserImplementationAddress);

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
            fundraiserImplementationAddress,
            deployer.address // Initial owner
        ],
        {
            kind: 'uups',
            initializer: 'initialize'
        }
    );
    
    await factoryProxy.waitForDeployment();
    const factoryProxyAddress = await factoryProxy.getAddress();
    
    console.log("Factory Proxy deployed to:", factoryProxyAddress);
    
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(factoryProxyAddress);
    console.log("Factory Implementation deployed to:", implementationAddress);

    console.log("\n=== Deployment Summary ===");
    console.log("USDCFundraiser Implementation:", fundraiserImplementationAddress);
    console.log("Factory Proxy Address:", factoryProxyAddress);
    console.log("Factory Implementation Address:", implementationAddress);
    
    console.log("\n=== Verification Commands ===");
    console.log("Verify USDCFundraiser Implementation:");
    console.log(`npx hardhat verify --network <network> ${fundraiserImplementationAddress}`);
    
    console.log("\nVerify Factory Implementation:");
    console.log(`npx hardhat verify --network <network> ${implementationAddress}`);

    // Save deployment addresses to file
    const deploymentInfo = {
        network: (await ethers.provider.getNetwork()).name,
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        addresses: {
            fundraiserImplementation: fundraiserImplementationAddress,
            factoryProxy: factoryProxyAddress,
            factoryImplementation: implementationAddress
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
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
