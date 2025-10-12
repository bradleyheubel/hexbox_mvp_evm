import { ethers } from "hardhat";
import deploymentInfo from "../deployment-fuji-test.json";

/**
 * Transfer ownership of deployed contracts to Safe multisig
 */

async function main() {
  const SAFE_ADDRESS = "0xde7A51Bc88dD021B7da9edA3617529C4De6cc368";
  
  console.log("\n🔄 TRANSFERRING OWNERSHIP TO SAFE");
  console.log("=".repeat(60));
  console.log("Safe Address:", SAFE_ADDRESS);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Verify network
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== BigInt(43113)) {
    console.error("❌ Not on Fuji testnet!");
    process.exit(1);
  }

  // Load contracts
  const factory = await ethers.getContractAt(
    "USDCFundraiserFactoryUpgradeable",
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
  console.log("   Current owner:", await factory.owner());
  
  const tx1 = await factory.transferOwnership(SAFE_ADDRESS);
  await tx1.wait();
  console.log("   ✅ Factory ownership transferred");
  console.log("   New owner:", await factory.owner());

  // ============================================================
  // STEP 2: Grant ProductToken Roles to Safe
  // ============================================================
  console.log("\n🎨 Step 2: Configuring ProductToken Roles");
  
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
  const UPGRADER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UPGRADER_ROLE"));
  
  console.log("   Granting DEFAULT_ADMIN_ROLE to Safe...");
  const tx2 = await productToken.grantRole(DEFAULT_ADMIN_ROLE, SAFE_ADDRESS);
  await tx2.wait();
  console.log("   ✅ Admin role granted");

  console.log("   Granting UPGRADER_ROLE to Safe...");
  const tx3 = await productToken.grantRole(UPGRADER_ROLE, SAFE_ADDRESS);
  await tx3.wait();
  console.log("   ✅ Upgrader role granted");

  // ============================================================
  // STEP 3: Renounce Deployer Roles
  // ============================================================
  console.log("\n🔓 Step 3: Renouncing Deployer Privileges");
  
  console.log("   Renouncing DEFAULT_ADMIN_ROLE...");
  const tx4 = await productToken.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
  await tx4.wait();
  console.log("   ✅ Admin role renounced");

  console.log("   Renouncing UPGRADER_ROLE...");
  const tx5 = await productToken.renounceRole(UPGRADER_ROLE, deployer.address);
  await tx5.wait();
  console.log("   ✅ Upgrader role renounced");

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
  
  console.log("\n⚠️  IMPORTANT:");
  console.log("   - Deployer can no longer upgrade contracts");
  console.log("   - All upgrades must go through Safe multisig");
  console.log("   - Verify Safe access before proceeding");
  
  console.log("\n📋 Next Steps:");
  console.log("   1. Verify Safe ownership in Safe UI:");
  console.log("      https://app.safe.global/");
  console.log("\n   2. Test upgrade via Safe:");
  console.log("      npx hardhat run scripts/test-upgrade-fuji.ts --network fuji");
  
  console.log("\n=".repeat(60) + "\n");
}

main().catch(console.error);
