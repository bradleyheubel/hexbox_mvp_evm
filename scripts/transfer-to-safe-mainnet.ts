import { ethers } from "hardhat";

// Note: deployment-mainnet.json will be created after deployment
let deploymentInfo: any;
try {
  deploymentInfo = require("../deployment-mainnet.json");
} catch {
  console.error("deployment-mainnet.json not found. Run deployment script first.");
  process.exit(1);
}

/**
 * Transfer ownership of mainnet contracts to Safe multisig
 * 
 * IMPORTANT: Make sure your Safe address is correct before running!
 */

async function main() {
  // UPDATE THIS WITH YOUR MAINNET SAFE ADDRESS
  const SAFE_ADDRESS = process.env.MAINNET_SAFE_ADDRESS || "";
  
  if (!SAFE_ADDRESS) {
    console.error("\n❌ ERROR: MAINNET_SAFE_ADDRESS not set!");
    console.error("   Set it in .env file or pass as environment variable:");
    console.error("   MAINNET_SAFE_ADDRESS=0x... npx hardhat run scripts/transfer-to-safe-mainnet.ts --network avalanche");
    process.exit(1);
  }
  
  console.log("\n🔄 TRANSFERRING OWNERSHIP TO SAFE (MAINNET)");
  console.log("=".repeat(60));
  console.log("Safe Address:", SAFE_ADDRESS);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Verify network
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== BigInt(43114)) {
    console.error("\n❌ ERROR: Not on Avalanche Mainnet!");
    console.error(`   Current Chain ID: ${network.chainId}`);
    console.error(`   Expected: 43114`);
    process.exit(1);
  }
  console.log("✅ Connected to Avalanche Mainnet");

  // Final confirmation
  console.log("\n⚠️  WARNING: This will transfer ownership on MAINNET!");
  console.log("   Safe Address: " + SAFE_ADDRESS);
  console.log("\n   Waiting 5 seconds... Press Ctrl+C to cancel.\n");
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Load contracts
  const factory = await ethers.getContractAt(
    "USDCFundraiserFactoryUpgradeableV09102025",
    deploymentInfo.addresses.factoryProxy
  );

  const productToken = await ethers.getContractAt(
    "ProductTokenUpgradeable",
    deploymentInfo.addresses.productTokenProxy
  );

  // ============================================================
  // STEP 1: Transfer Factory Ownership
  // ============================================================
  console.log("\n📦 Step 1: Transferring Factory Ownership");
  const currentOwner = await factory.owner();
  console.log("   Current owner:", currentOwner);
  
  if (currentOwner.toLowerCase() === SAFE_ADDRESS.toLowerCase()) {
    console.log("   ✅ Already owned by Safe");
  } else {
    console.log("   Transferring to Safe...");
    const tx1 = await factory.transferOwnership(SAFE_ADDRESS);
    await tx1.wait();
    console.log("   ✅ Factory ownership transferred");
    console.log("   TX:", tx1.hash);
  }
  
  const newOwner = await factory.owner();
  console.log("   New owner:", newOwner);

  // ============================================================
  // STEP 2: Grant ProductToken Roles to Safe
  // ============================================================
  console.log("\n🎨 Step 2: Configuring ProductToken Roles");
  
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
  const UPGRADER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UPGRADER_ROLE"));
  
  const hasAdmin = await productToken.hasRole(DEFAULT_ADMIN_ROLE, SAFE_ADDRESS);
  if (hasAdmin) {
    console.log("   ✅ Safe already has DEFAULT_ADMIN_ROLE");
  } else {
    console.log("   Granting DEFAULT_ADMIN_ROLE to Safe...");
    const tx2 = await productToken.grantRole(DEFAULT_ADMIN_ROLE, SAFE_ADDRESS);
    await tx2.wait();
    console.log("   ✅ Admin role granted");
    console.log("   TX:", tx2.hash);
  }

  const hasUpgrader = await productToken.hasRole(UPGRADER_ROLE, SAFE_ADDRESS);
  if (hasUpgrader) {
    console.log("   ✅ Safe already has UPGRADER_ROLE");
  } else {
    console.log("   Granting UPGRADER_ROLE to Safe...");
    const tx3 = await productToken.grantRole(UPGRADER_ROLE, SAFE_ADDRESS);
    await tx3.wait();
    console.log("   ✅ Upgrader role granted");
    console.log("   TX:", tx3.hash);
  }

  // ============================================================
  // STEP 3: Renounce Deployer Roles
  // ============================================================
  console.log("\n🔓 Step 3: Renouncing Deployer Privileges");
  
  const deployerHasAdmin = await productToken.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
  if (deployerHasAdmin) {
    console.log("   Renouncing DEFAULT_ADMIN_ROLE...");
    const tx4 = await productToken.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await tx4.wait();
    console.log("   ✅ Admin role renounced");
    console.log("   TX:", tx4.hash);
  } else {
    console.log("   ✅ Deployer already has no admin role");
  }

  const deployerHasUpgrader = await productToken.hasRole(UPGRADER_ROLE, deployer.address);
  if (deployerHasUpgrader) {
    console.log("   Renouncing UPGRADER_ROLE...");
    const tx5 = await productToken.renounceRole(UPGRADER_ROLE, deployer.address);
    await tx5.wait();
    console.log("   ✅ Upgrader role renounced");
    console.log("   TX:", tx5.hash);
  } else {
    console.log("   ✅ Deployer already has no upgrader role");
  }

  // ============================================================
  // VERIFICATION
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("✅ OWNERSHIP TRANSFER COMPLETE");
  console.log("=".repeat(60));
  
  console.log("\n📊 Final State:");
  console.log("   Factory Owner:", await factory.owner());
  console.log("   ProductToken Admin (Safe):", await productToken.hasRole(DEFAULT_ADMIN_ROLE, SAFE_ADDRESS));
  console.log("   ProductToken Upgrader (Safe):", await productToken.hasRole(UPGRADER_ROLE, SAFE_ADDRESS));
  console.log("   Deployer has admin:", await productToken.hasRole(DEFAULT_ADMIN_ROLE, deployer.address));
  console.log("   Deployer has upgrader:", await productToken.hasRole(UPGRADER_ROLE, deployer.address));
  
  console.log("\n🔗 Verify on Snowtrace:");
  console.log(`   Factory: https://snowtrace.io/address/${deploymentInfo.addresses.factoryProxy}`);
  console.log(`   ProductToken: https://snowtrace.io/address/${deploymentInfo.addresses.productTokenProxy}`);
  
  console.log("\n⚠️  CRITICAL:");
  console.log("   - Deployer can no longer upgrade contracts");
  console.log("   - All upgrades must go through Safe multisig");
  console.log("   - Verify Safe access before discarding deployer key");
  console.log("   - Test Safe functionality immediately");
  
  console.log("\n📋 Next Steps:");
  console.log("   1. Verify Safe ownership in Safe UI:");
  console.log("      https://app.safe.global/");
  console.log("\n   2. Test creating a campaign (backend wallet)");
  console.log("\n   3. Update frontend with contract addresses");
  console.log("\n   4. Set up monitoring and alerts");
  
  console.log("\n=".repeat(60) + "\n");
}

main().catch(console.error);
