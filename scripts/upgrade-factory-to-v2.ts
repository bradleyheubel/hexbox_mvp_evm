import { ethers, upgrades } from "hardhat";
import fs from 'fs';
import path from 'path';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading contract with account:", deployer.address);

  try {
    // Read deployment info to get proxy address
    const deploymentInfoPath = path.join(__dirname, '..', 'deployment-info.json');
    
    if (!fs.existsSync(deploymentInfoPath)) {
      throw new Error("Deployment info file not found. Please deploy contracts first.");
    }
    
    const fileData = fs.readFileSync(deploymentInfoPath, 'utf8');
    const deploymentInfo = JSON.parse(fileData);
    
    const factoryProxyAddress = deploymentInfo.addresses?.factoryProxy;
    if (!factoryProxyAddress) {
      throw new Error("Factory proxy address not found in deployment info.");
    }
    
    console.log(`\n=== Upgrading Factory Proxy at ${factoryProxyAddress} ===`);
    
    // Get the new implementation contract factory
    const FactoryV2 = await ethers.getContractFactory("USDCFundraiserFactoryUpgradeableV2");
    
    // Upgrade the proxy to use the new implementation
    const upgraded = await upgrades.upgradeProxy(factoryProxyAddress, FactoryV2);
    
    // Get the new implementation address
    const upgradedAddress = await upgraded.getAddress();
    const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(
      upgradedAddress
    );
    
    console.log("Factory proxy successfully upgraded");
    console.log("New implementation deployed at:", newImplementationAddress);
    
    // Update the deployment info
    deploymentInfo.addresses.factoryImplementation = newImplementationAddress;
    fs.writeFileSync(deploymentInfoPath, JSON.stringify(deploymentInfo, null, 2));
    
    console.log("\n=== Upgrade Summary ===");
    console.log("Factory Proxy (unchanged):", factoryProxyAddress);
    console.log("New Factory Implementation:", newImplementationAddress);
    
    console.log("\n=== Verification Command ===");
    console.log(`npx hardhat verify --network fuji ${newImplementationAddress}`);
    
  } catch (error) {
    console.error("Error during upgrade:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
