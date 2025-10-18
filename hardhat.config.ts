import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";

dotenv.config();

// Helper function to get accounts array
function getAccounts(): string[] {
  const accounts = [process.env.PRIVATE_KEY as string];
  
  // Add additional wallets if they exist
  if (process.env.PRIVATE_KEY_USER1) {
    accounts.push(process.env.PRIVATE_KEY_USER1);
  }
  if (process.env.PRIVATE_KEY_USER2) {
    accounts.push(process.env.PRIVATE_KEY_USER2);
  }
  
  return accounts.filter(key => key !== undefined);
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true  // Add this line
    }
  },
  networks: {
    fuji: {
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: getAccounts(),
    },
    avalanche: {
      url: "https://api.avax.network/ext/bc/C/rpc",
      chainId: 43114,
      accounts: getAccounts(),
      gasPrice: 25000000000, // 25 nAVAX
    }
  },
  etherscan: {
    apiKey: {
      avalancheFujiTestnet: process.env.ETHERSCAN_KEY as string,
      avalanche: process.env.SNOWTRACE_API_KEY as string
    }
  }
};

export default config;
