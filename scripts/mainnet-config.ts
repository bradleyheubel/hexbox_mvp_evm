/**
 * Avalanche Mainnet Configuration
 * 
 * IMPORTANT: Review and update all addresses before deployment!
 * This file contains mainnet-specific addresses and parameters.
 */

export const MAINNET_CONFIG = {
  // Network Information
  network: {
    name: "Avalanche C-Chain",
    chainId: 43114,
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    explorer: "https://snowtrace.io",
  },

  // Token Addresses (VERIFIED MAINNET ADDRESSES)
  tokens: {
    // USDC on Avalanche C-Chain (OFFICIAL)
    usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    // Verify at: https://snowtrace.io/token/0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E
  },

  // Deployment Configuration
  deployment: {
    // Fee Configuration
    defaultFeePercentage: 250, // 2.5% (250 basis points)
    
    // CRITICAL: Update these addresses before deployment
    // Use hardware wallet addresses or multisig for production
    feeWallet: process.env.MAINNET_FEE_WALLET_ADDRESS || "REPLACE_WITH_YOUR_FEE_WALLET",
    
    // Your mainnet Safe address (update before deployment)
    safeAddress: process.env.MAINNET_SAFE_ADDRESS || "REPLACE_WITH_YOUR_SAFE_ADDRESS",
    
    // Product Token Metadata
    // Ensure this URI is production-ready and accessible
    productTokenBaseUri: process.env.PRODUCT_TOKEN_BASE_URI || 
      "https://pub-7337cfa6ce8741dea70792ea29aa86e7.r2.dev/product_metadata/",
    
    // Gas Settings
    gasPrice: 25000000000, // 25 nAVAX (adjust based on network conditions)
    gasLimit: 8000000, // Conservative gas limit
  },

  // Chainlink Configuration (if using automation)
  chainlink: {
    // Chainlink Automation Registry on Avalanche Mainnet
    registryAddress: "0x02777053d6764996e594c3E88AF1D58D5363a2e6",
    registrarAddress: "0x4F3AF332A30973106Fe146Af0B4220bBBeA748eC",
    linkToken: "0x5947BB275c521040051D82396192181b413227A3",
  },

  // Security Settings
  security: {
    // Minimum time before allowing upgrades (in seconds)
    upgradeDelay: 86400, // 24 hours
    
    // Recommended: Use multisig for owner addresses
    useMultisig: true,
    
    // Emergency contacts
    emergencyContact: process.env.EMERGENCY_CONTACT || "",
  },

  // Verification
  verification: {
    // Get your API key from: https://snowtrace.io/myapikey
    snowtraceApiKey: process.env.SNOWTRACE_API_KEY || "",
    
    // Verification delay (wait for blocks to propagate)
    verificationDelay: 30000, // 30 seconds
  },

  // Estimated Costs (as of deployment date)
  estimatedCosts: {
    productTokenDeployment: "0.3 AVAX",
    fundraiserImplementation: "0.4 AVAX",
    factoryDeployment: "0.5 AVAX",
    totalEstimate: "1.2-2.0 AVAX",
    recommendedBalance: "5.0 AVAX", // For safety margin
  },
};

/**
 * Validation function to check configuration before deployment
 */
export function validateMainnetConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check USDC address
  if (MAINNET_CONFIG.tokens.usdc !== "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E") {
    errors.push("USDC address does not match official Avalanche USDC address");
  }

  // Check fee wallet
  if (
    !MAINNET_CONFIG.deployment.feeWallet ||
    MAINNET_CONFIG.deployment.feeWallet.includes("REPLACE")
  ) {
    errors.push("Fee wallet address not configured");
  }

  // Check Snowtrace API key
  if (!MAINNET_CONFIG.verification.snowtraceApiKey) {
    errors.push("Snowtrace API key not configured (required for verification)");
  }

  // Check base URI
  if (!MAINNET_CONFIG.deployment.productTokenBaseUri) {
    errors.push("Product token base URI not configured");
  }

  // Validate addresses format
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (
    MAINNET_CONFIG.deployment.feeWallet &&
    !addressRegex.test(MAINNET_CONFIG.deployment.feeWallet)
  ) {
    errors.push("Fee wallet address format is invalid");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Display configuration summary
 */
export function displayConfigSummary() {
  console.log("\n" + "=".repeat(60));
  console.log("AVALANCHE MAINNET DEPLOYMENT CONFIGURATION");
  console.log("=".repeat(60));
  console.log("\n📍 Network:");
  console.log(`   Name: ${MAINNET_CONFIG.network.name}`);
  console.log(`   Chain ID: ${MAINNET_CONFIG.network.chainId}`);
  console.log(`   RPC: ${MAINNET_CONFIG.network.rpcUrl}`);
  
  console.log("\n💰 Token Addresses:");
  console.log(`   USDC: ${MAINNET_CONFIG.tokens.usdc}`);
  
  console.log("\n⚙️  Configuration:");
  console.log(`   Fee Percentage: ${MAINNET_CONFIG.deployment.defaultFeePercentage / 100}%`);
  console.log(`   Fee Wallet: ${MAINNET_CONFIG.deployment.feeWallet}`);
  console.log(`   Base URI: ${MAINNET_CONFIG.deployment.productTokenBaseUri}`);
  
  console.log("\n💸 Estimated Costs:");
  console.log(`   Total Deployment: ${MAINNET_CONFIG.estimatedCosts.totalEstimate}`);
  console.log(`   Recommended Balance: ${MAINNET_CONFIG.estimatedCosts.recommendedBalance}`);
  
  console.log("\n" + "=".repeat(60) + "\n");
}

export default MAINNET_CONFIG;
