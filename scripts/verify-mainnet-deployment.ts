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
 * Verify mainnet deployment is correct
 */

async function main() {
  console.log("\n✅ VERIFYING MAINNET DEPLOYMENT");
  console.log("=".repeat(60));

  // Verify network
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== BigInt(43114)) {
    console.error("❌ Not on Avalanche Mainnet!");
    process.exit(1);
  }
  console.log("✅ Connected to Avalanche Mainnet");

  // Load contracts
  const factory = await ethers.getContractAt(
    "USDCFundraiserFactoryUpgradeable",
    deploymentInfo.addresses.factoryProxy
  );

  const productToken = await ethers.getContractAt(
    "ProductTokenUpgradeable",
    deploymentInfo.addresses.productTokenProxy
  );

  console.log("\n📊 Contract Addresses:");
  console.log("   Factory Proxy:", deploymentInfo.addresses.factoryProxy);
  console.log("   ProductToken Proxy:", deploymentInfo.addresses.productTokenProxy);

  // ============================================================
  // Verify Factory Configuration
  // ============================================================
  console.log("\n🏭 Factory Configuration:");
  
  try {
    const owner = await factory.owner();
    console.log("   ✅ Owner:", owner);

    const usdcAddress = await factory.usdcAddress();
    console.log("   ✅ USDC Address:", usdcAddress);
    
    // Verify it's the correct USDC
    const expectedUSDC = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E";
    if (usdcAddress.toLowerCase() === expectedUSDC.toLowerCase()) {
      console.log("      ✅ Correct USDC address");
    } else {
      console.log("      ❌ WARNING: Unexpected USDC address!");
    }

    const productTokenAddress = await factory.productTokenAddress();
    console.log("   ✅ ProductToken:", productTokenAddress);

    const feePercentage = await factory.defaultFeePercentage();
    console.log("   ✅ Fee Percentage:", feePercentage.toString(), "basis points (" + (Number(feePercentage) / 100) + "%)");

    const feeWallet = await factory.feeWallet();
    console.log("   ✅ Fee Wallet:", feeWallet);

    const fundraiserImpl = await factory.fundraiserImplementation();
    console.log("   ✅ Fundraiser Implementation:", fundraiserImpl);

  } catch (error) {
    console.error("   ❌ Error reading factory:", error);
  }

  // ============================================================
  // Verify ProductToken Configuration
  // ============================================================
  console.log("\n🎨 ProductToken Configuration:");
  
  try {
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
    const UPGRADER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UPGRADER_ROLE"));

    const factoryHasMinter = await productToken.hasRole(MINTER_ROLE, deploymentInfo.addresses.factoryProxy);
    console.log("   ✅ Factory has MINTER_ROLE:", factoryHasMinter);
    
    if (!factoryHasMinter) {
      console.log("      ❌ WARNING: Factory cannot mint tokens!");
    }

    // Check if Safe has admin roles (if transferred)
    const safeAddress = process.env.MAINNET_SAFE_ADDRESS;
    if (safeAddress) {
      const safeHasAdmin = await productToken.hasRole(DEFAULT_ADMIN_ROLE, safeAddress);
      const safeHasUpgrader = await productToken.hasRole(UPGRADER_ROLE, safeAddress);
      console.log("   ✅ Safe has ADMIN_ROLE:", safeHasAdmin);
      console.log("   ✅ Safe has UPGRADER_ROLE:", safeHasUpgrader);
    }

  } catch (error) {
    console.error("   ❌ Error reading ProductToken:", error);
  }

  // ============================================================
  // Verify Proxy Implementations
  // ============================================================
  console.log("\n🔗 Proxy Implementations:");
  
  try {
    const { upgrades } = require("hardhat");
    
    const factoryImpl = await upgrades.erc1967.getImplementationAddress(
      deploymentInfo.addresses.factoryProxy
    );
    console.log("   ✅ Factory Implementation:", factoryImpl);
    console.log("      Expected:", deploymentInfo.addresses.factoryImplementation);
    console.log("      Match:", factoryImpl.toLowerCase() === deploymentInfo.addresses.factoryImplementation.toLowerCase() ? "✅" : "❌");

    const productTokenImpl = await upgrades.erc1967.getImplementationAddress(
      deploymentInfo.addresses.productTokenProxy
    );
    console.log("   ✅ ProductToken Implementation:", productTokenImpl);
    console.log("      Expected:", deploymentInfo.addresses.productTokenImplementation);
    console.log("      Match:", productTokenImpl.toLowerCase() === deploymentInfo.addresses.productTokenImplementation.toLowerCase() ? "✅" : "❌");

  } catch (error) {
    console.error("   ❌ Error reading implementations:", error);
  }

  // ============================================================
  // Summary
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("📋 VERIFICATION SUMMARY");
  console.log("=".repeat(60));
  
  console.log("\n🔗 Snowtrace Links:");
  console.log(`   Factory: https://snowtrace.io/address/${deploymentInfo.addresses.factoryProxy}`);
  console.log(`   ProductToken: https://snowtrace.io/address/${deploymentInfo.addresses.productTokenProxy}`);
  console.log(`   Fundraiser Impl: https://snowtrace.io/address/${deploymentInfo.addresses.fundraiserImplementation}`);

  console.log("\n📋 Checklist:");
  console.log("   [ ] All contracts deployed");
  console.log("   [ ] USDC address is correct");
  console.log("   [ ] Factory has correct configuration");
  console.log("   [ ] ProductToken has MINTER_ROLE granted to factory");
  console.log("   [ ] Ownership transferred to Safe (if applicable)");
  console.log("   [ ] Contracts verified on Snowtrace");

  console.log("\n=".repeat(60) + "\n");
}

main().catch(console.error);
