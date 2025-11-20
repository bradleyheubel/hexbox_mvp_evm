const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Upgrading fundraiser implementation with account:", deployer.address);

    // Load deployment info
    const fs = require('fs');
    let deploymentInfo;
    try {
        deploymentInfo = JSON.parse(fs.readFileSync('deployment-fuji-test.json', 'utf8'));
    } catch (error) {
        console.error("Could not load deployment-fuji-test.json. Make sure you have deployed the contracts first.");
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

    console.log("\n=== Generating Safe Transaction Data ===");
    
    // Get factory contract instance
    const USDCFundraiserFactoryUpgradeable = await ethers.getContractFactory("USDCFundraiserFactoryUpgradeable");
    const factory = USDCFundraiserFactoryUpgradeable.attach(FACTORY_PROXY_ADDRESS);
    
    // Get factory owner (Safe wallet)
    const factoryOwner = await factory.owner();
    console.log("Factory Owner (Safe Wallet):", factoryOwner);
    
    // Generate encoded transaction data
    const newImplementationAddress = await newFundraiserImplementation.getAddress();
    const encodedData = factory.interface.encodeFunctionData("updateFundraiserImplementation", [
        newImplementationAddress
    ]);
    
    console.log("\n" + "=".repeat(80));
    console.log("📋 COPY THESE VALUES INTO SAFE UI");
    console.log("=".repeat(80));
    
    console.log("\n1️⃣  TO ADDRESS (Factory Proxy):");
    console.log("   " + FACTORY_PROXY_ADDRESS);
    
    console.log("\n2️⃣  VALUE (Amount in AVAX):");
    console.log("   0");
    
    console.log("\n3️⃣  DATA (Hex Encoded):");
    console.log("   " + encodedData);
    
    console.log("\n4️⃣  FUNCTION:");
    console.log("   updateFundraiserImplementation(address)");
    
    console.log("\n5️⃣  PARAMETER:");
    console.log("   newImplementation: " + newImplementationAddress);
    
    console.log("\n" + "=".repeat(80));
    console.log("📖 INSTRUCTIONS");
    console.log("=".repeat(80));
    console.log("\n1. Go to your Safe wallet UI:");
    console.log("   https://app.safe.global/transactions/queue?safe=avax:" + factoryOwner);
    
    console.log("\n2. Click 'New Transaction' → 'Contract Interaction'");
    
    console.log("\n3. Enter the transaction details above");
    
    console.log("\n4. Review, get signatures, and execute");
    
    // Update deployment info with pending upgrade
    deploymentInfo.upgrades = deploymentInfo.upgrades || [];
    deploymentInfo.upgrades.push({
        timestamp: new Date().toISOString(),
        type: 'fundraiser-implementation-pending',
        oldImplementation: deploymentInfo.addresses.fundraiserImplementation,
        newImplementation: newImplementationAddress,
        status: 'PENDING - Waiting for Safe execution'
    });

    fs.writeFileSync('deployment-fuji-test.json', JSON.stringify(deploymentInfo, null, 2));
    console.log("\n✅ Pending upgrade info saved to deployment-fuji-test.json");

    console.log("\n" + "=".repeat(80));
    console.log("⚠️  IMPORTANT NOTES");
    console.log("=".repeat(80));
    console.log("\n✅ New implementation deployed at:", newImplementationAddress);
    console.log("⏳ Waiting for Safe wallet to execute the update transaction");
    console.log("📝 After Safe execution, new fundraisers will use the new implementation");
    console.log("⚠️  Existing fundraiser instances will continue using their original implementation");

    console.log("\n" + "=".repeat(80));
    console.log("🔍 VERIFICATION");
    console.log("=".repeat(80));
    console.log("\nAfter Safe execution, verify the update:");
    console.log("1. Check factory implementation:");
    console.log("   npx hardhat console --network <network>");
    console.log("   const factory = await ethers.getContractAt('USDCFundraiserFactoryUpgradeable', '" + FACTORY_PROXY_ADDRESS + "')");
    console.log("   await factory.fundraiserImplementation()");
    console.log("\n2. Verify new implementation contract:");
    console.log("   npx hardhat verify --network <network> " + newImplementationAddress);
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
