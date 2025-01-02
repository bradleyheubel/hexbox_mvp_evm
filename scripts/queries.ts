import { ethers } from "hardhat"

async function main() {
    // Get the deployed contracts
    const MockUSDC = await ethers.getContractFactory("MockUSDC")
    const USDCFundraiser = await ethers.getContractFactory("USDCFundraiser")

    // Replace these with your actual deployed addresses
    const MOCK_USDC_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3" // Replace with your deployed MockUSDC address
    const FUNDRAISER_ADDRESS = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512" // Replace with your deployed USDCFundraiser address

    // Get contract instances at their deployed addresses
    const mockUSDC = MockUSDC.attach(MOCK_USDC_ADDRESS) as unknown as MockUSDC
    const fundraiser = USDCFundraiser.attach(FUNDRAISER_ADDRESS) as unknown as USDCFundraiser

    // Get signers
    const [owner, investor] = await ethers.getSigners()

    // Example queries
    console.log("Owner USDC Balance:", await mockUSDC.balanceOf(owner.address))
    console.log("Total Raised:", await fundraiser.totalRaised())
    console.log("Beneficiary Wallet:", await fundraiser.beneficiaryWallet())
    console.log("Minimum Target:", await fundraiser.minimumTarget())

    // 1. Transfer USDC to investor
    const transferAmount = 1000_000000n // 1000 USDC (6 decimals)
    console.log("Transferring USDC to investor...")
    await mockUSDC.transfer(investor.address, transferAmount)
    console.log("Investor USDC Balance:", await mockUSDC.balanceOf(investor.address))

    // 2. Approve fundraiser to spend investor's USDC
    console.log("Approving fundraiser to spend USDC...")
    await mockUSDC.connect(investor).approve(FUNDRAISER_ADDRESS, transferAmount)

    // 3. Deposit USDC to fundraiser
    console.log("Depositing USDC to fundraiser...")
    await fundraiser.connect(investor).deposit(transferAmount)
    
    // 4. Check balances after deposit
    console.log("Investor's deposit in fundraiser:", await fundraiser.deposits(investor.address))
    console.log("Total raised:", await fundraiser.totalRaised())

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })