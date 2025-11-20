import { ethers } from "hardhat";

/**
 * Campaign Inspector Script
 * 
 * Inspects a USDCFundraiser campaign and displays all details
 * 
 * Usage:
 *   npx hardhat run scripts/inspect-campaign.ts --network fuji
 *   npx hardhat run scripts/inspect-campaign.ts --network avalanche
 * 
 * Set CAMPAIGN_ADDRESS environment variable or modify the script
 */

// Network configurations
const NETWORK_CONFIG = {
  fuji: {
    name: "Avalanche Fuji Testnet",
    chainId: 43113,
    explorer: "https://testnet.snowtrace.io",
    usdcAddress: "0x5425890298aed601595a70AB815c96711a31Bc65",
  },
  avalanche: {
    name: "Avalanche Mainnet",
    chainId: 43114,
    explorer: "https://snowtrace.io",
    usdcAddress: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", // USDC on Avalanche mainnet
  }
};

// Funding type descriptions
const FUNDING_TYPES = {
  0: "All or Nothing",
  1: "Limitless",
  2: "Flexible"
};

interface CampaignDetails {
  // Basic Info
  address: string;
  owner: string;
  campaignAdmin: string;
  beneficiaryWallet: string;
  
  // Financial Info
  usdc: string;
  feeWallet: string;
  feePercentage: bigint;
  totalRaised: bigint;
  minimumTarget: bigint;
  
  // Campaign Status
  fundingType: number;
  deadline: bigint;
  finalized: boolean;
  paused: boolean;
  
  // Products
  productIds: bigint[];
  products: Array<{
    productId: bigint;
    originalProductId: bigint;
    price: bigint;
    supplyLimit: bigint;
    soldCount: bigint;
  }>;
  
  // Token Info
  productToken: string;
  factory: string;
}

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("🔍 CAMPAIGN INSPECTOR");
  console.log("=".repeat(80));

  // Get campaign address from environment or command line
  const campaignAddress = "0x29dba53036b822e643f886782caf7bf177b64508"
  
  if (!campaignAddress) {
    console.error("\n❌ Error: CAMPAIGN_ADDRESS not provided");
    console.error("\nUsage:");
    console.error("  CAMPAIGN_ADDRESS=0x... npx hardhat run scripts/inspect-campaign.ts --network fuji");
    console.error("  CAMPAIGN_ADDRESS=0x... npx hardhat run scripts/inspect-campaign.ts --network avalanche");
    process.exit(1);
  }

  // Validate address
  if (!ethers.isAddress(campaignAddress)) {
    console.error("\n❌ Error: Invalid campaign address:", campaignAddress);
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
  console.log("   Campaign Address:", campaignAddress);

  // Load campaign contract
  const campaign = await ethers.getContractAt("USDCFundraiserUpgradeable", campaignAddress);
  
  console.log("\n⏳ Fetching campaign details...");

  try {
    // Fetch all campaign data
    const details: CampaignDetails = {
      address: campaignAddress,
      owner: await campaign.owner(),
      campaignAdmin: await campaign.campaignAdmin(),
      beneficiaryWallet: await campaign.beneficiaryWallet(),
      usdc: await campaign.usdc(),
      feeWallet: await campaign.feeWallet(),
      feePercentage: await campaign.feePercentage(),
      totalRaised: await campaign.totalRaised(),
      minimumTarget: await campaign.minimumTarget(),
      fundingType: Number(await campaign.fundingType()),
      deadline: await campaign.deadline(),
      finalized: await campaign.finalized(),
      paused: await campaign.paused(),
      productIds: await campaign.getProductIds(),
      products: [],
      productToken: await campaign.productToken(),
      factory: await campaign.factory(),
    };

    // Fetch product details
    for (const productId of details.productIds) {
      try {
        // Get original product ID
        const originalProductId = await campaign.getOriginalProductId(productId);
        
        // Get product config
        const product = await campaign.products(productId);
        const soldCount = await campaign.productSoldCount(productId);
        
        details.products.push({
          productId: productId,
          originalProductId: originalProductId,
          price: product.price,
          supplyLimit: product.supplyLimit,
          soldCount: soldCount,
        });
      } catch (error) {
        console.warn(`   ⚠️  Could not fetch details for product ${productId.toString()}`);
      }
    }

    // Display campaign details
    displayCampaignDetails(details, config);

  } catch (error: any) {
    console.error("\n❌ Error fetching campaign details:", error.message);
    console.error("\nPossible reasons:");
    console.error("  - Invalid campaign address");
    console.error("  - Campaign contract not deployed at this address");
    console.error("  - Network mismatch");
    process.exit(1);
  }
}

function displayCampaignDetails(details: CampaignDetails, config: any) {
  console.log("\n" + "=".repeat(80));
  console.log("📊 CAMPAIGN DETAILS");
  console.log("=".repeat(80));

  // Basic Information
  console.log("\n🏢 Basic Information");
  console.log("   Campaign Address:", details.address);
  console.log("   Owner:", details.owner);
  console.log("   Campaign Admin:", details.campaignAdmin);
  console.log("   Beneficiary Wallet:", details.beneficiaryWallet);
  console.log("   Factory:", details.factory);
  console.log("   Product Token:", details.productToken);

  // Financial Information
  console.log("\n💰 Financial Information");
  console.log("   USDC Address:", details.usdc);
  console.log("   Fee Wallet:", details.feeWallet);
  console.log("   Fee Percentage:", `${(Number(details.feePercentage) / 100).toFixed(2)}% (${details.feePercentage} basis points)`);
  console.log("   Total Raised:", ethers.formatUnits(details.totalRaised, 6), "USDC");
  console.log("   Minimum Target:", ethers.formatUnits(details.minimumTarget, 6), "USDC");
  
  const progressPercentage = details.minimumTarget > 0n 
    ? (Number(details.totalRaised) / Number(details.minimumTarget) * 100).toFixed(2)
    : "N/A";
  console.log("   Progress:", `${progressPercentage}%`);

  // Campaign Status
  console.log("\n📅 Campaign Status");
  console.log("   Funding Type:", `${FUNDING_TYPES[details.fundingType as keyof typeof FUNDING_TYPES]} (${details.fundingType})`);
  
  const deadlineDate = new Date(Number(details.deadline) * 1000);
  const now = new Date();
  const isExpired = deadlineDate < now;
  const timeRemaining = isExpired 
    ? "Expired" 
    : formatTimeRemaining(Number(details.deadline) - Math.floor(now.getTime() / 1000));
  
  console.log("   Deadline:", deadlineDate.toLocaleString());
  console.log("   Time Remaining:", timeRemaining);
  console.log("   Finalized:", details.finalized ? "✅ Yes" : "❌ No");
  console.log("   Paused:", details.paused ? "⚠️  Yes" : "✅ No");
  
  // Campaign State Analysis
  console.log("\n🎯 Campaign State");
  if (details.finalized) {
    console.log("   Status: Campaign is finalized");
  } else if (isExpired) {
    console.log("   Status: Campaign deadline has passed (not yet finalized)");
  } else {
    console.log("   Status: Campaign is active");
  }
  
  if (details.fundingType === 0) {
    // All or Nothing
    if (details.totalRaised >= details.minimumTarget) {
      console.log("   Target Status: ✅ Target met - funds will be released");
    } else {
      console.log("   Target Status: ❌ Target not met - refunds available if deadline passes");
    }
  } else if (details.fundingType === 1) {
    // Limitless
    console.log("   Target Status: No target (limitless campaign)");
  } else if (details.fundingType === 2) {
    // Flexible
    if (details.totalRaised >= details.minimumTarget) {
      console.log("   Target Status: ✅ Target met - funds will be released");
    } else {
      console.log("   Target Status: ⚠️  Target not met - funds still released (flexible)");
    }
  }

  // Products
  console.log("\n🛍️  Products (" + details.products.length + " total)");
  console.log("=".repeat(80));
  
  if (details.products.length === 0) {
    console.log("   No products found");
  } else {
    details.products.forEach((product, index) => {
      console.log(`\n   Product #${index + 1}`);
      console.log("   " + "-".repeat(76));
      console.log("   Original Product ID:", product.originalProductId.toString());
      console.log("   Unique Product ID:", product.productId.toString());
      console.log("   Price:", ethers.formatUnits(product.price, 6), "USDC");
      console.log("   Supply Limit:", product.supplyLimit === 0n ? "Unlimited" : product.supplyLimit.toString());
      console.log("   Sold Count:", product.soldCount.toString());
      
      if (product.supplyLimit > 0n) {
        const availableSupply = product.supplyLimit - product.soldCount;
        const soldPercentage = (Number(product.soldCount) / Number(product.supplyLimit) * 100).toFixed(2);
        console.log("   Available:", availableSupply.toString());
        console.log("   Sold:", `${soldPercentage}%`);
      }
      
      const totalRevenue = product.price * product.soldCount;
      console.log("   Total Revenue:", ethers.formatUnits(totalRevenue, 6), "USDC");
    });
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("📈 SUMMARY");
  console.log("=".repeat(80));
  console.log(`   Total Products: ${details.products.length}`);
  console.log(`   Total Items Sold: ${details.products.reduce((sum, p) => sum + Number(p.soldCount), 0)}`);
  console.log(`   Total Raised: ${ethers.formatUnits(details.totalRaised, 6)} USDC`);
  console.log(`   Campaign Status: ${details.finalized ? "Finalized" : "Active"}`);
  
  // Links
  console.log("\n🔗 Links");
  console.log("   Campaign:", `${config.explorer}/address/${details.address}`);
  console.log("   Product Token:", `${config.explorer}/address/${details.productToken}`);
  console.log("   Factory:", `${config.explorer}/address/${details.factory}`);
  
  console.log("\n" + "=".repeat(80));
  console.log("✅ Inspection complete!");
  console.log("=".repeat(80) + "\n");
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "Expired";
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.join(" ") || "< 1m";
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
