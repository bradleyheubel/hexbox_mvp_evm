async function main() {
  const contractAddress = "0x7a390b23cd163f6ee3ceac29bbfd7edf213f4e21"; // Replace with your address
  
  const Contract = await ethers.getContractFactory("USDCFundraiserUpgradeable");
  const contract = Contract.attach(contractAddress);
  
  console.log("Checking contract:", contractAddress);
  
  try {
    const usdc = await contract.usdc();
    console.log("✓ USDC address:", usdc);
    console.log("✓ Contract is initialized!");
  } catch (error) {
    console.log("✗ Failed to call usdc():", error.message);
    console.log("Contract may not be initialized or wrong address");
  }
}

main().catch(console.error);