const { ethers, upgrades } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Upgrading contracts with account:", deployer.address);

    // Load deployment info
    const fs = require('fs');
    let deploymentInfo;
    try {
        deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
    } catch (error) {
        console.error("Could not load deployment-info.json. Make sure you have deployed the contracts first.");
        process.exit(1);
    }

    const FACTORY_PROXY_ADDRESS = deploymentInfo.addresses.factoryProxy;
    
    console.log("Factory Proxy Address:", FACTORY_PROXY_ADDRESS);
    console.log("Current Implementation:", await upgrades.erc1967.getImplementationAddress(FACTORY_PROXY_ADDRESS));

    console.log("\n=== Upgrading USDCFundraiserFactoryUpgradeable ===");
    
    // Deploy new version of the factory
    const USDCFundraiserFactoryUpgradeableV2 = await ethers.getContractFactory("USDCFundraiserFactoryUpgradeable");
    
    const upgradedFactory = await upgrades.upgradeProxy(FACTORY_PROXY_ADDRESS, USDCFundraiserFactoryUpgradeableV2);
    await upgradedFactory.waitForDeployment();
    
    console.log("Factory upgraded successfully!");
    console.log("Proxy Address (unchanged):", await upgradedFactory.getAddress());
    console.log("New Implementation Address:", await upgrades.erc1967.getImplementationAddress(await upgradedFactory.getAddress()));

    // Update deployment info
    deploymentInfo.upgrades = deploymentInfo.upgrades || [];
    deploymentInfo.upgrades.push({
        timestamp: new Date().toISOString(),
        type: 'factory',
        proxyAddress: await upgradedFactory.getAddress(),
        newImplementation: await upgrades.erc1967.getImplementationAddress(await upgradedFactory.getAddress())
    });

    fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
    console.log("\nUpgrade info saved to deployment-info.json");

    console.log("\n=== Verification Command ===");
    console.log("Verify new implementation:");
    console.log(`npx hardhat verify --network <network> ${await upgrades.erc1967.getImplementationAddress(await upgradedFactory.getAddress())}`);
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
