import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy Mock USDC first (for testing)
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  console.log("MockUSDC deployed to:", await mockUSDC.getAddress());

  // Deploy ProductToken
  const ProductToken = await ethers.getContractFactory("ProductToken");
  const productToken = await ProductToken.deploy("https://api.example.com/token/");
  await productToken.waitForDeployment();
  console.log("ProductToken deployed to:", await productToken.getAddress());

  // Deploy USDCFundraiser
  const oneDay = 24 * 60 * 60;
  const deadline = Math.floor(Date.now() / 1000) + oneDay; // 1 day from now
  const minimumTarget = 1000_000000n; // 1000 USDC (6 decimals)

  const USDCFundraiser = await ethers.getContractFactory("USDCFundraiser");
  const fundraiser = await USDCFundraiser.deploy(
    await mockUSDC.getAddress(),    // USDC address
    deployer.address,               // beneficiary wallet
    deployer.address,               // fee wallet
    minimumTarget,                  // minimum target
    deadline,                       // deadline
    true,                           // enforce conditions
    await productToken.getAddress() // product token address
  );
  await fundraiser.waitForDeployment();
  
  console.log("USDCFundraiser deployed to:", await fundraiser.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 