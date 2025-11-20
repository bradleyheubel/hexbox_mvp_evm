/**
 * Avalanche Fuji Testnet Configuration
 */

export const FUJI_CONFIG = {
  // Network Information
  network: {
    name: "Avalanche Fuji Testnet",
    chainId: 43113,
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    explorer: "https://testnet.snowtrace.io",
  },

  // Token Addresses (FUJI TESTNET)
  tokens: {
    // USDC on Fuji testnet
    usdc: "0x5425890298aed601595a70AB815c96711a31Bc65",
  },

  // Deployment Configuration
  deployment: {
    // Fee Configuration
    defaultFeePercentage: 250, // 2.5% (250 basis points)
    
    // Your Fuji Safe wallet
    safeAddress: "0xde7A51Bc88dD021B7da9edA3617529C4De6cc368",
    
    // Fee wallet (can be same as Safe for testing)
    feeWallet: "0x254Dc55ECb273A96D1143D51F52961fa9de68E99",
    
    // Product Token Metadata (testing URI)
    productTokenBaseUri: process.env.PRODUCT_TOKEN_BASE_URI || 
      "https://pub-7337cfa6ce8741dea70792ea29aa86e7.r2.dev/product_metadata/",
  },
};

export default FUJI_CONFIG;
