import { ethers, upgrades } from "hardhat";
import deploymentInfo from "../deployment-fuji-test.json";

/**
 * Test upgrade process via Safe multisig on Fuji
 * 
 * This script:
 * 1. Deploys new factory implementation
 * 2. Validates upgrade compatibility
 * 3. Provides transaction data for Safe
 */

async function main() {
  console.log("\n🔄 TESTING UPGRADE PROCESS ON FUJI");
  console.log("=".repeat(60));

  const SAFE_ADDRESS = "0xde7A51Bc88dD021B7da9edA3617529C4De6cc368";
  const FACTORY_PROXY = deploymentInfo.addresses.factoryProxy;

  const [proposer] = await ethers.getSigners();
  console.log("👤 Proposer:", proposer.address);
  console.log("🔐 Safe Address:", SAFE_ADDRESS);
  console.log("🏭 Factory Proxy:", FACTORY_PROXY);

  // Verify network
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== BigInt(43113)) {
    console.error("❌ Not on Fuji testnet!");
    process.exit(1);
  }

  // ============================================================
  // STEP 1: Verify Current State
  // ============================================================
  console.log("\n📊 Step 1: Verifying Current State");
  
  const factory = await ethers.getContractAt(
    "USDCFundraiserFactoryUpgradeable",
    FACTORY_PROXY
  );

  const currentOwner = await factory.owner();
  console.log("   Current Factory Owner:", currentOwner);
  
  if (currentOwner.toLowerCase() !== SAFE_ADDRESS.toLowerCase()) {
    console.error("\n❌ Factory not owned by Safe!");
    console.error("   Run: npx hardhat run scripts/transfer-to-safe-fuji.ts --network fuji");
    process.exit(1);
  }
  console.log("   ✅ Factory owned by Safe");

  const currentImpl = await upgrades.erc1967.getImplementationAddress(FACTORY_PROXY);

  // ============================================================
  // STEP 2: Deploy New Implementation
  // ============================================================
  console.log("\n📦 Step 2: Deploying New Implementation");
  const NewFactoryImplementation = await ethers.getContractFactory(
    "USDCFundraiserFactoryUpgradeable"
  );
  
  console.log("   Validating upgrade compatibility...");
  try {
    await upgrades.validateUpgrade(
      FACTORY_PROXY,
      NewFactoryImplementation,
      { kind: 'uups' }
    );
    console.log("   ✅ Upgrade validation passed");
  } catch (error) {
    console.error("   ❌ Upgrade validation failed!");
    console.error(error);
    process.exit(1);
  }

  console.log("   Deploying new implementation...");
  const newImplementation = await NewFactoryImplementation.deploy();
  await newImplementation.waitForDeployment();
  const newImplAddress = await newImplementation.getAddress();
  
  console.log("   ✅ New Implementation:", newImplAddress);

  // ============================================================
  // STEP 3: Prepare Upgrade Transaction Data
  // ============================================================
  console.log("\n🔧 Step 3: Preparing Upgrade Transaction");
  
  // Encode the upgrade function call
  const upgradeData = factory.interface.encodeFunctionData(
    "upgradeToAndCall",
    [newImplAddress, "0x"] // Empty bytes if no initialization needed
  );

  console.log("   Transaction prepared");

  // ============================================================
  // STEP 4: Instructions for Safe UI
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("📋 SAFE TRANSACTION BUILDER INSTRUCTIONS");
  console.log("=".repeat(60));
  
  console.log("\n🌐 Step 1: Go to Safe Web App");
  console.log("   URL: https://app.safe.global/");
  console.log("   Network: Avalanche Fuji Testnet");
  console.log("   Safe: " + SAFE_ADDRESS);

  console.log("\n📝 Step 2: Create New Transaction");
  console.log("   1. Click 'New Transaction'");
  console.log("   2. Select 'Transaction Builder'");

  console.log("\n⚙️  Step 3: Enter Transaction Details");
  console.log("   To Address:");
  console.log("   " + FACTORY_PROXY);
  console.log("\n   Value:");
  console.log("   0");
  console.log("\n   Data (ABI):");
  console.log("   Select 'upgradeToAndCall(address,bytes)'");
  console.log("\n   Parameters:");
  console.log("   - newImplementation: " + newImplAddress);
  console.log("   - data: 0x");

  console.log("\n✍️  Step 4: Sign & Execute");
  console.log("   1. Review transaction");
  console.log("   2. Click 'Create'");
  console.log("   3. Sign with required signers");
  console.log("   4. Execute when threshold reached");

  console.log("\n" + "=".repeat(60));
  console.log("📋 ALTERNATIVE: RAW TRANSACTION DATA");
  console.log("=".repeat(60));
  console.log("\nIf you prefer to use raw data:");
  console.log("\nTo:", FACTORY_PROXY);
  console.log("Value: 0");
  console.log("Data:", upgradeData);

  // ============================================================
  // STEP 5: Verification Instructions
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("✅ AFTER EXECUTING IN SAFE");
  console.log("=".repeat(60));
  
  console.log("\nRun this command to verify upgrade:");
  console.log("npx hardhat run scripts/verify-upgrade-fuji.ts --network fuji");

  console.log("\nOr check manually:");
  console.log("npx hardhat console --network fuji");
  console.log("\nThen run:");
  console.log("const { upgrades } = require('hardhat');");
  console.log(`const impl = await upgrades.erc1967.getImplementationAddress('${FACTORY_PROXY}');`);
  console.log("console.log('Current implementation:', impl);");
  console.log(`// Should be: ${newImplAddress}`);

  // Save upgrade info
  const upgradeInfo = {
    timestamp: new Date().toISOString(),
    network: "fuji",
    proposer: proposer.address,
    safeAddress: SAFE_ADDRESS,
    proxyAddress: FACTORY_PROXY,
    oldImplementation: currentImpl,
    newImplementation: newImplAddress,
    upgradeData: upgradeData,
    status: "pending-safe-execution"
  };

  const fs = require('fs');
  const path = require('path');
  fs.writeFileSync(
    path.join(__dirname, '..', 'upgrade-fuji-pending.json'),
    JSON.stringify(upgradeInfo, null, 2)
  );

  console.log("\n💾 Upgrade info saved to upgrade-fuji-pending.json");
  console.log("=".repeat(60) + "\n");
}

main().catch(console.error);
