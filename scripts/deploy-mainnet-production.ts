import { ethers, upgrades } from "hardhat";
import fs from "fs";
import path from "path";
import { MAINNET_CONFIG } from "./mainnet-config";

/**
 * Deploy contracts to Avalanche Mainnet
 * 
 * CRITICAL: This deploys to REAL mainnet with REAL money!
 */

async function main() {
  console.log("\n🚀 AVALANCHE MAINNET DEPLOYMENT");
  console.log("=".repeat(60));
  
  const [deployer] = await ethers.getSigners();
  console.log("👤 Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  const balanceInAvax = ethers.formatEther(balance);
  console.log("💰 Balance:", balanceInAvax, "AVAX");
  
  // Check sufficient balance
  if (balance < ethers.parseEther("2")) {
    console.error(`\n❌ Insufficient balance! You have ${balanceInAvax} AVAX`);
    console.error("   Minimum required: 2.0 AVAX");
    console.error("   Recommended: 5.0 AVAX");
    process.exit(1);
  }

  // Verify network
  const network = await ethers.provider.getNetwork();
  console.log("🌐 Network:", network.name);
  console.log("🔗 Chain ID:", network.chainId.toString());
  
  if (network.chainId !== BigInt(43114)) {
    console.error("\n❌ ERROR: Not connected to Avalanche Mainnet!");
    console.error(`   Expected Chain ID: 43114`);
    console.error(`   Current Chain ID: ${network.chainId}`);
    process.exit(1);
  }
  console.log("✅ Connected to Avalanche Mainnet");

  // Final confirmation
  console.log("\n" + "⚠️ ".repeat(30));
  console.log("⚠️  WARNING: YOU ARE DEPLOYING TO AVALANCHE MAINNET!");
  console.log("⚠️  This will cost real AVAX and deploy real contracts.");
  console.log("⚠️  Make sure you have reviewed all configuration!");
  console.log("⚠️ ".repeat(30));
  console.log("\n⏸️  Waiting 10 seconds before deployment...");
  console.log("   Press Ctrl+C to cancel if you're not ready.\n");
  
  await new Promise(resolve => setTimeout(resolve, 10000));

  const deploymentResults: any = {
    network: "avalanche-mainnet",
    chainId: 43114,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    addresses: {},
    config: {
      usdcAddress: MAINNET_CONFIG.tokens.usdc,
      defaultFeePercentage: MAINNET_CONFIG.deployment.defaultFeePercentage,
      feeWallet: MAINNET_CONFIG.deployment.feeWallet,
      baseUri: MAINNET_CONFIG.deployment.productTokenBaseUri,
    },
  };

  try {
    // ============================================================
    // STEP 1: Deploy ProductTokenUpgradeable
    // ============================================================
    console.log("\n" + "=".repeat(60));
    console.log("📦 STEP 1: Deploying ProductTokenUpgradeable (UUPS Proxy)");
    console.log("=".repeat(60));
    
    const ProductTokenFactory = await ethers.getContractFactory("ProductTokenUpgradeable");
    
    console.log("   Deploying proxy and implementation...");
    const productTokenProxy = await upgrades.deployProxy(
      ProductTokenFactory,
      [MAINNET_CONFIG.deployment.productTokenBaseUri],
      {
        kind: "uups",
        initializer: "initialize",
      }
    );
    
    await productTokenProxy.waitForDeployment();
    const productTokenProxyAddress = await productTokenProxy.getAddress();
    const productTokenImplAddress = await upgrades.erc1967.getImplementationAddress(
      productTokenProxyAddress
    );
    
    deploymentResults.addresses.productTokenProxy = productTokenProxyAddress;
    deploymentResults.addresses.productTokenImplementation = productTokenImplAddress;
    
    console.log("✅ ProductToken Proxy:", productTokenProxyAddress);
    console.log("✅ ProductToken Implementation:", productTokenImplAddress);

    // ============================================================
    // STEP 2: Deploy USDCFundraiserUpgradeable Implementation
    // ============================================================
    console.log("\n" + "=".repeat(60));
    console.log("📦 STEP 2: Deploying USDCFundraiserUpgradeable Implementation");
    console.log("=".repeat(60));
    
    const USDCFundraiserUpgradeable = await ethers.getContractFactory("USDCFundraiserUpgradeable");
    
    console.log("   Deploying implementation...");
    const fundraiserImplementation = await USDCFundraiserUpgradeable.deploy();
    await fundraiserImplementation.waitForDeployment();
    
    const fundraiserImplementationAddress = await fundraiserImplementation.getAddress();
    deploymentResults.addresses.fundraiserImplementation = fundraiserImplementationAddress;
    
    console.log("✅ Fundraiser Implementation:", fundraiserImplementationAddress);

    // ============================================================
    // STEP 3: Deploy USDCFundraiserFactoryUpgradeable
    // ============================================================
    console.log("\n" + "=".repeat(60));
    console.log("📦 STEP 3: Deploying USDCFundraiserFactoryUpgradeable (UUPS Proxy)");
    console.log("=".repeat(60));
    
    const USDCFundraiserFactoryUpgradeable = await ethers.getContractFactory(
      "USDCFundraiserFactoryUpgradeable"
    );
    
    console.log("   Deploying factory proxy and implementation...");
    const factoryProxy = await upgrades.deployProxy(
      USDCFundraiserFactoryUpgradeable,
      [
        MAINNET_CONFIG.tokens.usdc,
        productTokenProxyAddress,
        MAINNET_CONFIG.deployment.defaultFeePercentage,
        MAINNET_CONFIG.deployment.feeWallet,
        fundraiserImplementationAddress,
        deployer.address, // Initial owner (will transfer to Safe)
      ],
      {
        kind: "uups",
        initializer: "initialize",
      }
    );
    
    await factoryProxy.waitForDeployment();
    const factoryProxyAddress = await factoryProxy.getAddress();
    const factoryImplAddress = await upgrades.erc1967.getImplementationAddress(
      factoryProxyAddress
    );
    
    deploymentResults.addresses.factoryProxy = factoryProxyAddress;
    deploymentResults.addresses.factoryImplementation = factoryImplAddress;
    
    console.log("✅ Factory Proxy:", factoryProxyAddress);
    console.log("✅ Factory Implementation:", factoryImplAddress);

    // ============================================================
    // STEP 4: Grant MINTER_ROLE to Factory
    // ============================================================
    console.log("\n" + "=".repeat(60));
    console.log("🔐 STEP 4: Configuring Permissions");
    console.log("=".repeat(60));
    
    console.log("   Granting MINTER_ROLE to factory...");
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const grantRoleTx = await productTokenProxy.grantRole(MINTER_ROLE, factoryProxyAddress);
    await grantRoleTx.wait();
    
    console.log("✅ MINTER_ROLE granted to factory");

    // ============================================================
    // STEP 5: Save Deployment Information
    // ============================================================
    const deploymentInfoPath = path.join(__dirname, "..", "deployment-mainnet.json");
    fs.writeFileSync(deploymentInfoPath, JSON.stringify(deploymentResults, null, 2));
    
    console.log("\n" + "=".repeat(60));
    console.log("🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(60));
    
    console.log("\n📍 Deployed Addresses:");
    console.log("   ProductToken Proxy:        ", productTokenProxyAddress);
    console.log("   ProductToken Implementation:", productTokenImplAddress);
    console.log("   Fundraiser Implementation: ", fundraiserImplementationAddress);
    console.log("   Factory Proxy:             ", factoryProxyAddress);
    console.log("   Factory Implementation:    ", factoryImplAddress);
    
    console.log("\n🔗 Snowtrace Links:");
    console.log(`   ProductToken: https://snowtrace.io/address/${productTokenProxyAddress}`);
    console.log(`   Factory: https://snowtrace.io/address/${factoryProxyAddress}`);
    
    console.log("\n🔍 Verification Commands:");
    console.log("\n   # Verify ProductToken Implementation");
    console.log(`   npx hardhat verify --network avalanche ${productTokenImplAddress}`);
    
    console.log("\n   # Verify Fundraiser Implementation");
    console.log(`   npx hardhat verify --network avalanche ${fundraiserImplementationAddress}`);
    
    console.log("\n   # Verify Factory Implementation");
    console.log(`   npx hardhat verify --network avalanche ${factoryImplAddress}`);
    
    console.log("\n📋 Next Steps:");
    console.log("   1. Verify contracts on Snowtrace (commands above)");
    console.log("   2. Transfer ownership to Safe:");
    console.log("      npx hardhat run scripts/transfer-to-safe-mainnet.ts --network avalanche");
    console.log("   3. Test factory functionality");
    console.log("   4. Update frontend with new addresses");
    
    console.log("\n⚠️  CRITICAL REMINDERS:");
    console.log("   - Backup deployment-mainnet.json securely");
    console.log("   - Transfer ownership to Safe immediately");
    console.log("   - Test with small amounts first");
    console.log("   - Monitor all transactions");
    
    console.log("\n💾 Deployment info saved to deployment-mainnet.json");
    console.log("=".repeat(60) + "\n");
    
  } catch (error) {
    console.error("\n❌ DEPLOYMENT FAILED!");
    console.error(error);
    
    const errorInfoPath = path.join(__dirname, "..", "deployment-mainnet-error.json");
    deploymentResults.error = error instanceof Error ? error.message : String(error);
    deploymentResults.status = "failed";
    fs.writeFileSync(errorInfoPath, JSON.stringify(deploymentResults, null, 2));
    
    console.error("\n⚠️  Partial deployment info saved to deployment-mainnet-error.json");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
