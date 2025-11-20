import { ethers } from "hardhat";

/**
 * Generate Pause/Unpause Transaction Data for Safe Wallet
 * 
 * Generates the encoded transaction data that can be submitted through Safe UI
 * 
 * Usage:
 *   CAMPAIGN_ADDRESS=0x... ACTION=pause npx hardhat run scripts/generate-pause-transaction.ts --network fuji
 *   CAMPAIGN_ADDRESS=0x... ACTION=unpause npx hardhat run scripts/generate-pause-transaction.ts --network avalanche
 */

// Network configurations
const NETWORK_CONFIG = {
  fuji: {
    name: "Avalanche Fuji Testnet",
    chainId: 43113,
    explorer: "https://testnet.snowtrace.io",
    safeUI: "https://app.safe.global/transactions/queue?safe=avax:",
  },
  avalanche: {
    name: "Avalanche Mainnet",
    chainId: 43114,
    explorer: "https://snowtrace.io",
    safeUI: "https://app.safe.global/transactions/queue?safe=avax:",
  }
};

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("🔐 GENERATE SAFE TRANSACTION DATA");
  console.log("=".repeat(80));

  // Get campaign address from environment
  const campaignAddress = process.env.CAMPAIGN_ADDRESS;
  
  if (!campaignAddress) {
    console.error("\n❌ Error: CAMPAIGN_ADDRESS not provided");
    console.error("\nUsage:");
    console.error("  CAMPAIGN_ADDRESS=0x... ACTION=pause npx hardhat run scripts/generate-pause-transaction.ts --network fuji");
    console.error("  CAMPAIGN_ADDRESS=0x... ACTION=unpause npx hardhat run scripts/generate-pause-transaction.ts --network fuji");
    process.exit(1);
  }

  // Validate address
  if (!ethers.isAddress(campaignAddress)) {
    console.error("\n❌ Error: Invalid campaign address:", campaignAddress);
    process.exit(1);
  }

  // Get action from environment
  const action = (process.env.ACTION || "").toLowerCase();
  
  if (!["pause", "unpause"].includes(action)) {
    console.error("\n❌ Error: ACTION must be specified as 'pause' or 'unpause'");
    console.error("\nExamples:");
    console.error("  ACTION=pause CAMPAIGN_ADDRESS=0x... npx hardhat run scripts/generate-pause-transaction.ts --network fuji");
    console.error("  ACTION=unpause CAMPAIGN_ADDRESS=0x... npx hardhat run scripts/generate-pause-transaction.ts --network fuji");
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
  console.log("   Campaign Address:", campaignAddress);
  console.log("   Action:", action.toUpperCase());

  // Load campaign contract
  const campaign = await ethers.getContractAt("USDCFundraiserUpgradeable", campaignAddress);

  // Get campaign info
  console.log("\n📋 Campaign Information");
  try {
    const campaignOwner = await campaign.owner();
    const campaignAdmin = await campaign.campaignAdmin();
    const isPaused = await campaign.paused();
    const isFinalized = await campaign.finalized();
    
    console.log("   Owner:", campaignOwner);
    console.log("   Admin:", campaignAdmin);
    console.log("   Current Status:", isPaused ? "⏸️  PAUSED" : "▶️  ACTIVE");
    console.log("   Finalized:", isFinalized ? "Yes" : "No");

    // Validate action makes sense
    if (action === "pause" && isPaused) {
      console.warn("\n⚠️  WARNING: Campaign is already paused!");
    }
    if (action === "unpause" && !isPaused) {
      console.warn("\n⚠️  WARNING: Campaign is already active (not paused)!");
    }

    // Generate transaction data
    console.log("\n" + "=".repeat(80));
    console.log("📝 TRANSACTION DATA FOR SAFE");
    console.log("=".repeat(80));

    let encodedData: string;
    let functionName: string;

    if (action === "pause") {
      encodedData = campaign.interface.encodeFunctionData("pause", []);
      functionName = "pause()";
    } else {
      encodedData = campaign.interface.encodeFunctionData("unpause", []);
      functionName = "unpause()";
    }

    console.log("\n📋 Copy these values into Safe UI:");
    console.log("\n1️⃣  TO ADDRESS (Contract Address):");
    console.log("   " + campaignAddress);
    
    console.log("\n2️⃣  VALUE (Amount in AVAX):");
    console.log("   0");
    
    console.log("\n3️⃣  DATA (Hex Encoded):");
    console.log("   " + encodedData);
    
    console.log("\n4️⃣  FUNCTION:");
    console.log("   " + functionName);

    // Additional information
    console.log("\n" + "=".repeat(80));
    console.log("📖 INSTRUCTIONS");
    console.log("=".repeat(80));
    console.log("\n1. Go to your Safe wallet UI:");
    console.log("   " + config.safeUI + campaignOwner);
    
    console.log("\n2. Click 'New Transaction' → 'Contract Interaction'");
    
    console.log("\n3. Enter the following details:");
    console.log("   • To Address: " + campaignAddress);
    console.log("   • Value: 0");
    console.log("   • Data (hex encoded): " + encodedData);
    
    console.log("\n4. Review and submit the transaction");
    
    console.log("\n5. Get required signatures from Safe owners");
    
    console.log("\n6. Execute the transaction");

    // Verification info
    console.log("\n" + "=".repeat(80));
    console.log("🔍 VERIFICATION");
    console.log("=".repeat(80));
    console.log("\nAfter execution, verify the transaction:");
    console.log("   • Check campaign status changed");
    console.log("   • View transaction on explorer: " + config.explorer + "/address/" + campaignAddress);

    // Decoded function info
    console.log("\n" + "=".repeat(80));
    console.log("🔧 TECHNICAL DETAILS");
    console.log("=".repeat(80));
    console.log("\nFunction Selector:", encodedData.slice(0, 10));
    console.log("Function Name:", functionName);
    console.log("Parameters:", action === "pause" || action === "unpause" ? "None" : "N/A");
    console.log("Encoded Data Length:", encodedData.length, "characters");

    // Alternative: Generate Safe transaction URL (if supported)
    console.log("\n" + "=".repeat(80));
    console.log("🔗 QUICK LINKS");
    console.log("=".repeat(80));
    console.log("\nSafe UI:", config.safeUI + campaignOwner);
    console.log("Campaign Contract:", config.explorer + "/address/" + campaignAddress);
    console.log("Campaign Owner (Safe):", config.explorer + "/address/" + campaignOwner);

    console.log("\n" + "=".repeat(80));
    console.log("✅ Transaction data generated successfully!");
    console.log("=".repeat(80) + "\n");

  } catch (error: any) {
    console.error("\n❌ Error fetching campaign details:", error.message);
    console.error("\nPossible reasons:");
    console.error("  - Invalid campaign address");
    console.error("  - Campaign contract not deployed at this address");
    console.error("  - Network mismatch");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
