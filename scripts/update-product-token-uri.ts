import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Update Product Token Base URI Script
 * 
 * Updates the base URI for product token metadata
 * 
 * Usage:
 *   NEW_BASE_URI=https://... npx hardhat run scripts/update-product-token-uri.ts --network fuji
 *   NEW_BASE_URI=https://... npx hardhat run scripts/update-product-token-uri.ts --network avalanche
 */

// Network configurations
const NETWORK_CONFIG = {
  fuji: {
    name: "Avalanche Fuji Testnet",
    chainId: 43113,
    explorer: "https://testnet.snowtrace.io",
    deploymentFile: "deployment-fuji-test.json",
  },
  avalanche: {
    name: "Avalanche Mainnet",
    chainId: 43114,
    explorer: "https://snowtrace.io",
    deploymentFile: "deployment-info.json",
  }
};

interface DeploymentInfo {
  addresses: {
    productTokenProxy: string;
  };
  config?: {
    baseUri?: string;
  };
}

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("🔄 UPDATE PRODUCT TOKEN BASE URI");
  console.log("=".repeat(80));

  // Get new base URI from environment
  const newBaseUri = "https://pub-7337cfa6ce8741dea70792ea29aa86e7.r2.dev/product_metadata/"
  
//   if (!newBaseUri) {
//     console.error("\n❌ Error: NEW_BASE_URI not provided");
//     console.error("\nUsage:");
//     console.error("  NEW_BASE_URI=https://... npx hardhat run scripts/update-product-token-uri.ts --network fuji");
//     console.error("  NEW_BASE_URI=https://... npx hardhat run scripts/update-product-token-uri.ts --network avalanche");
//     console.error("\nExample:");
//     console.error('  NEW_BASE_URI="https://pub-7337cfa6ce8741dea70792ea29aa86e7.r2.dev/product_metadata/" npx hardhat run scripts/update-product-token-uri.ts --network fuji');
//     process.exit(1);
//   }

  // Validate URI format
  if (!newBaseUri.startsWith("http://") && !newBaseUri.startsWith("https://")) {
    console.error("\n❌ Error: Invalid URI format. Must start with http:// or https://");
    process.exit(1);
  }

  // Get network info
  const network = await ethers.provider.getNetwork();
  const networkName = network.chainId === BigInt(43113) ? "fuji" : 
                      network.chainId === BigInt(43114) ? "avalanche" : "unknown";
  
  if (networkName === "unknown") {
    console.error("\n❌ Error: Unsupported network. Chain ID:", network.chainId.toString());
    console.error("   Supported networks: Fuji (43113), Avalanche Mainnet (43114)");
    process.exit(1);
  }

  const config = NETWORK_CONFIG[networkName as keyof typeof NETWORK_CONFIG];
  
  console.log("\n📡 Network Information");
  console.log("   Network:", config.name);
  console.log("   Chain ID:", network.chainId.toString());
  console.log("   Explorer:", config.explorer);

  // Load deployment info
  const deploymentPath = path.join(__dirname, "..", config.deploymentFile);
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("\n❌ Error: Deployment file not found:", config.deploymentFile);
    console.error("   Expected path:", deploymentPath);
    process.exit(1);
  }

  const deploymentInfo: DeploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const productTokenAddress = deploymentInfo.addresses.productTokenProxy;

  if (!productTokenAddress) {
    console.error("\n❌ Error: Product token address not found in deployment file");
    process.exit(1);
  }

  console.log("\n📦 Product Token Information");
  console.log("   Address:", productTokenAddress);
  console.log("   Current Base URI:", deploymentInfo.config?.baseUri || "Not recorded");
  console.log("   New Base URI:", newBaseUri);

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log("\n👤 Signer");
  console.log("   Address:", signer.address);
  console.log("   Balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "AVAX");

  // Load product token contract
  const productToken = await ethers.getContractAt("ProductTokenUpgradeable", productTokenAddress);

  // Check if signer has admin role
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const hasAdminRole = await productToken.hasRole(DEFAULT_ADMIN_ROLE, signer.address);

  if (!hasAdminRole) {
    console.error("\n❌ Error: Signer does not have DEFAULT_ADMIN_ROLE");
    console.error("   Required role:", DEFAULT_ADMIN_ROLE);
    console.error("   Signer address:", signer.address);
    console.error("\n   Only accounts with DEFAULT_ADMIN_ROLE can update the base URI");
    process.exit(1);
  }

  console.log("   Has Admin Role: ✅ Yes");

  // Confirm update
  console.log("\n⚠️  WARNING: You are about to update the product token base URI");
  console.log("   This will affect how all product NFT metadata is resolved");
  console.log("\n   Network:", config.name);
  console.log("   Product Token:", productTokenAddress);
  console.log("   New Base URI:", newBaseUri);

  // Check if running in CI or if confirmation is disabled
  const skipConfirmation = process.env.SKIP_CONFIRMATION === "true";
  
  if (!skipConfirmation) {
    console.log("\n   Set SKIP_CONFIRMATION=true to bypass this prompt");
    console.log("\n   Press Ctrl+C to cancel, or wait 10 seconds to continue...");
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  console.log("\n🔄 Updating base URI...");

  try {
    // Update base URI
    const tx = await productToken.setBaseURI(newBaseUri);
    console.log("   Transaction submitted:", tx.hash);
    console.log("   Explorer:", `${config.explorer}/tx/${tx.hash}`);
    
    console.log("   Waiting for confirmation...");
    const receipt = await tx.wait();
    
    if (receipt?.status === 1) {
      console.log("   ✅ Transaction confirmed!");
      console.log("   Block:", receipt.blockNumber);
      console.log("   Gas used:", receipt.gasUsed.toString());
    } else {
      throw new Error("Transaction failed");
    }

    // Verify the update
    console.log("\n🔍 Verifying update...");
    
    // Get a sample product ID to test URI
    const productIds = await productToken.getProductIds();
    if (productIds.length > 0) {
      const sampleProductId = productIds[0];
      const uri = await productToken.uri(sampleProductId);
      console.log("   Sample Product ID:", sampleProductId.toString());
      console.log("   Sample URI:", uri);
      
      if (uri.startsWith(newBaseUri)) {
        console.log("   ✅ URI update verified!");
      } else {
        console.warn("   ⚠️  Warning: URI does not start with new base URI");
      }
    } else {
      console.log("   No products minted yet, cannot verify URI");
    }

    // Update deployment file
    console.log("\n📝 Updating deployment file...");
    deploymentInfo.config = deploymentInfo.config || {};
    deploymentInfo.config.baseUri = newBaseUri;
    
    fs.writeFileSync(
      deploymentPath,
      JSON.stringify(deploymentInfo, null, 2) + "\n"
    );
    console.log("   ✅ Deployment file updated:", config.deploymentFile);

    // Success summary
    console.log("\n" + "=".repeat(80));
    console.log("✅ BASE URI UPDATE COMPLETE");
    console.log("=".repeat(80));
    console.log("\n   Network:", config.name);
    console.log("   Product Token:", productTokenAddress);
    console.log("   New Base URI:", newBaseUri);
    console.log("   Transaction:", `${config.explorer}/tx/${tx.hash}`);
    console.log("\n" + "=".repeat(80));

  } catch (error: any) {
    console.error("\n❌ Error updating base URI:", error.message);
    
    if (error.message.includes("Invalid base URI")) {
      console.error("\n   The contract rejected the URI. Possible reasons:");
      console.error("   - URI is empty");
      console.error("   - URI format is invalid");
    } else if (error.message.includes("AccessControl")) {
      console.error("\n   Access control error. Make sure you have DEFAULT_ADMIN_ROLE");
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
