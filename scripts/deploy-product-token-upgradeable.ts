import { ethers, upgrades } from "hardhat";
import fs from 'fs';
import path from 'path';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "AVAX");

  // Base URI for the token metadata
  const baseUri = "https://pub-7337cfa6ce8741dea70792ea29aa86e7.r2.dev/products_metadata/";
  
  try {
    // Deploy ProductTokenUpgradeable with UUPS proxy
    console.log("\n=== Deploying ProductTokenUpgradeable with UUPS Proxy ===");
    
    const ProductTokenFactory = await ethers.getContractFactory("ProductTokenUpgradeable");
    
    const productTokenProxy = await upgrades.deployProxy(
      ProductTokenFactory, 
      [baseUri], 
      { 
        kind: "uups",
        initializer: "initialize"
      }
    );
    
    await productTokenProxy.waitForDeployment();
    
    // Get the implementation address
    const proxyAddress = await productTokenProxy.getAddress();
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(
      proxyAddress
    );
    
    console.log("ProductToken Proxy deployed to:", proxyAddress);
    console.log("ProductToken Implementation deployed to:", implementationAddress);
    
    // Save deployment information
    const network = await ethers.provider.getNetwork();
    const networkName = network.name === 'unknown' ? 'hardhat' : network.name;
    
    const deploymentInfo = {
      network: networkName,
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      addresses: {
        productTokenProxy: proxyAddress,
        productTokenImplementation: implementationAddress
      },
      config: {
        baseUri
      }
    };
    
    // Read existing deployment info if it exists
    let existingDeploymentInfo = {};
    const deploymentInfoPath = path.join(__dirname, '..', 'deployment-info.json');
    
    if (fs.existsSync(deploymentInfoPath)) {
      try {
        const fileData = fs.readFileSync(deploymentInfoPath, 'utf8');
        existingDeploymentInfo = JSON.parse(fileData);
        
        // Merge the productToken addresses with existing deployment info
        if (!existingDeploymentInfo.addresses) {
          existingDeploymentInfo.addresses = {};
        }
        
        existingDeploymentInfo.addresses.productTokenProxy = proxyAddress;
        existingDeploymentInfo.addresses.productTokenImplementation = implementationAddress;
        
        if (!existingDeploymentInfo.config) {
          existingDeploymentInfo.config = {};
        }
        existingDeploymentInfo.config.baseUri = baseUri;
        
      } catch (err) {
        console.error("Error reading existing deployment info:", err);
        // If there's an error reading the file, just use the new deployment info
        existingDeploymentInfo = deploymentInfo;
      }
    } else {
      // No existing file, use the new deployment info
      existingDeploymentInfo = deploymentInfo;
    }
    
    // Write to the deployment info file
    fs.writeFileSync(
      deploymentInfoPath,
      JSON.stringify(existingDeploymentInfo, null, 2)
    );
    
    console.log("\n=== Deployment Summary ===");
    console.log("ProductToken Proxy:", proxyAddress);
    console.log("ProductToken Implementation:", implementationAddress);
    
    console.log("\n=== Verification Commands ===");
    console.log("Verify ProductToken Implementation:");
    console.log(`npx hardhat verify --network fuji ${implementationAddress}`);
    
    console.log("\nDeployment info saved to deployment-info.json");
    
  } catch (error) {
    console.error("Error during deployment:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
