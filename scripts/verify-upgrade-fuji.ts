import { ethers, upgrades } from "hardhat";
import deploymentInfo from "../deployment-fuji-test.json";
import upgradeInfo from "../upgrade-fuji-pending.json";

/**
 * Verify that the upgrade was successful
 */

async function main() {
  console.log("\n✅ VERIFYING UPGRADE");
  console.log("=".repeat(60));

  const FACTORY_PROXY = deploymentInfo.addresses.factoryProxy;

  // Verify network
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== BigInt(43113)) {
    console.error("❌ Not on Fuji testnet!");
    process.exit(1);
  }

  // Get current implementation
  const currentImpl = await upgrades.erc1967.getImplementationAddress(FACTORY_PROXY);
  
  console.log("\n📊 Implementation Addresses:");
  console.log("   Expected (new):", upgradeInfo.newImplementation);
  console.log("   Current:       ", currentImpl);

  if (currentImpl.toLowerCase() === upgradeInfo.newImplementation.toLowerCase()) {
    console.log("\n🎉 ✅ UPGRADE SUCCESSFUL!");
    console.log("   Factory is now using the new implementation");
  } else if (currentImpl.toLowerCase() === upgradeInfo.oldImplementation.toLowerCase()) {
    console.log("\n⚠️  UPGRADE NOT YET EXECUTED");
    console.log("   Factory is still using the old implementation");
    console.log("   Complete the Safe transaction to upgrade");
  } else {
    console.log("\n❓ UNEXPECTED IMPLEMENTATION");
    console.log("   The current implementation doesn't match old or new");
  }

  // Test factory functionality
  console.log("\n🧪 Testing Factory Functionality:");
  const factory = await ethers.getContractAt(
    "USDCFundraiserFactoryUpgradeable",
    FACTORY_PROXY
  );

  try {
    const owner = await factory.owner();
    console.log("   ✅ Can read owner:", owner);

    const usdcAddress = await factory.usdcAddress();
    console.log("   ✅ Can read USDC address:", usdcAddress);

    const feePercentage = await factory.defaultFeePercentage();
    console.log("   ✅ Can read fee percentage:", feePercentage.toString());

    console.log("\n✅ All functionality tests passed!");
  } catch (error) {
    console.error("\n❌ Functionality test failed!");
    console.error(error);
  }

  console.log("\n=".repeat(60) + "\n");
}

main().catch(console.error);
