import { ethers, upgrades } from "hardhat";
import fs from "fs";
import path from "path";
import { FUJI_CONFIG } from "./fuji-config";

/**
 * Deploy contracts to Fuji testnet for Safe upgrade testing
 */

async function main() {
  console.log("\n🧪 FUJI TESTNET DEPLOYMENT");
  console.log("=".repeat(60));
  
  const [deployer] = await ethers.getSigners();
  console.log("👤 Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "AVAX");
  
  if (balance < ethers.parseEther("2")) {
    console.error("\n❌ Insufficient balance!");
    console.error("Get testnet AVAX from: https://faucet.avax.network/");
    process.exit(1);
  }

  // Verify network
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== BigInt(43113)) {
    console.error("❌ Not on Fuji testnet! Chain ID:", network.chainId);
    process.exit(1);
  }
  console.log("✅ Connected to Fuji testnet");

  const deploymentResults: any = {
    network: "fuji",
    chainId: 43113,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    safeAddress: FUJI_CONFIG.deployment.safeAddress,
    addresses: {},
    config: {
      usdcAddress: FUJI_CONFIG.tokens.usdc,
      defaultFeePercentage: FUJI_CONFIG.deployment.defaultFeePercentage,
      feeWallet: FUJI_CONFIG.deployment.feeWallet,
      baseUri: FUJI_CONFIG.deployment.productTokenBaseUri,
    },
  };

  try {
    // ============================================================
    // STEP 1: Deploy ProductTokenUpgradeable
    // ============================================================
    console.log("\n" + "=".repeat(60));
    console.log("📦 STEP 1: Deploying ProductTokenUpgradeable");
    console.log("=".repeat(60));
    
    const ProductTokenFactory = await ethers.getContractFactory("ProductTokenUpgradeable");
    
    console.log("   Deploying proxy and implementation...");
    const productTokenProxy = await upgrades.deployProxy(
      ProductTokenFactory,
      [FUJI_CONFIG.deployment.productTokenBaseUri],
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
    console.log("📦 STEP 3: Deploying USDCFundraiserFactoryUpgradeable");
    console.log("=".repeat(60));
    
    const USDCFundraiserFactoryUpgradeable = await ethers.getContractFactory(
      "USDCFundraiserFactoryUpgradeable"
    );
    
    console.log("   Deploying factory proxy and implementation...");
    const factoryProxy = await upgrades.deployProxy(
      USDCFundraiserFactoryUpgradeable,
      [
        FUJI_CONFIG.tokens.usdc,
        productTokenProxyAddress,
        FUJI_CONFIG.deployment.defaultFeePercentage,
        FUJI_CONFIG.deployment.feeWallet,
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
    const deploymentInfoPath = path.join(__dirname, "..", "deployment-fuji-test.json");
    fs.writeFileSync(deploymentInfoPath, JSON.stringify(deploymentResults, null, 2));
    
    console.log("\n" + "=".repeat(60));
    console.log("🎉 DEPLOYMENT COMPLETED!");
    console.log("=".repeat(60));
    
    console.log("\n📍 Deployed Addresses:");
    console.log("   ProductToken Proxy:        ", productTokenProxyAddress);
    console.log("   ProductToken Implementation:", productTokenImplAddress);
    console.log("   Fundraiser Implementation: ", fundraiserImplementationAddress);
    console.log("   Factory Proxy:             ", factoryProxyAddress);
    console.log("   Factory Implementation:    ", factoryImplAddress);
    
    console.log("\n🔗 Fuji Snowtrace Links:");
    console.log(`   ProductToken: https://testnet.snowtrace.io/address/${productTokenProxyAddress}`);
    console.log(`   Factory: https://testnet.snowtrace.io/address/${factoryProxyAddress}`);
    
    console.log("\n📋 Next Steps:");
    console.log("   1. Run transfer script:");
    console.log("      npx hardhat run scripts/transfer-to-safe-fuji.ts --network fuji");
    console.log("\n   2. Test upgrade:");
    console.log("      npx hardhat run scripts/test-upgrade-fuji.ts --network fuji");
    
    console.log("\n💾 Deployment info saved to deployment-fuji-test.json");
    console.log("=".repeat(60) + "\n");
    
  } catch (error) {
    console.error("\n❌ DEPLOYMENT FAILED!");
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
