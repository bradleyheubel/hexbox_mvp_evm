const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Upgrading fundraiser implementation with account:", deployer.address);

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

    console.log("\n=== Deploying New USDCFundraiserUpgradeable Implementation ===");
    
    // Deploy new implementation of USDCFundraiser
    const USDCFundraiserUpgradeableV2 = await ethers.getContractFactory("USDCFundraiserUpgradeable");
    const newFundraiserImplementation = await USDCFundraiserUpgradeableV2.deploy();
    await newFundraiserImplementation.waitForDeployment();
    
    console.log("New USDCFundraiser Implementation deployed to:", await newFundraiserImplementation.getAddress());

    console.log("\n=== Updating Factory with New Implementation ===");
    
    // Get factory contract instance
    const USDCFundraiserFactoryUpgradeable = await ethers.getContractFactory("USDCFundraiserFactoryUpgradeable");
    const factory = USDCFundraiserFactoryUpgradeable.attach(FACTORY_PROXY_ADDRESS);
    
    // Update the implementation address in the factory
    const tx = await factory.updateFundraiserImplementation(await newFundraiserImplementation.getAddress());
    await tx.wait();
    
    console.log("Factory updated with new fundraiser implementation!");
    console.log("Transaction hash:", tx.hash);

    // Verify the update
    const currentImplementation = await factory.fundraiserImplementation();
    console.log("Current fundraiser implementation in factory:", currentImplementation);
    
    if (currentImplementation.toLowerCase() === (await newFundraiserImplementation.getAddress()).toLowerCase()) {
        console.log("✅ Implementation update successful!");
    } else {
        console.log("❌ Implementation update failed!");
    }

    // Update deployment info
    deploymentInfo.upgrades = deploymentInfo.upgrades || [];
    deploymentInfo.upgrades.push({
        timestamp: new Date().toISOString(),
        type: 'fundraiser-implementation',
        oldImplementation: deploymentInfo.addresses.fundraiserImplementation,
        newImplementation: await newFundraiserImplementation.getAddress(),
        updateTxHash: tx.hash
    });

    // Update the main implementation address
    deploymentInfo.addresses.fundraiserImplementation = await newFundraiserImplementation.getAddress();

    fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
    console.log("\nUpgrade info saved to deployment-info.json");

    console.log("\n=== Important Notes ===");
    console.log("✅ New fundraisers created from now on will use the new implementation");
    console.log("⚠️  Existing fundraiser instances will continue using their original implementation");
    console.log("💡 To upgrade existing fundraisers, you would need to implement a migration mechanism");

    console.log("\n=== Verification Command ===");
    console.log("Verify new implementation:");
    console.log(`npx hardhat verify --network <network> ${await newFundraiserImplementation.getAddress()}`);
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
