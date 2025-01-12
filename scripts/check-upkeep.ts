import { ethers } from "hardhat";

async function main() {
    const FUNDRAISER_ADDRESS = "0xcbD7Cf14A519a14c3854DCa385d7E4Af28C4B0B3";
    const fundraiser = await ethers.getContractAt("USDCFundraiser", FUNDRAISER_ADDRESS);

    // Check upkeep status
    const [upkeepNeeded, performData] = await fundraiser.checkUpkeep("0x");
    console.log("Upkeep needed:", upkeepNeeded);
    console.log("Perform data:", performData);

    // Additional useful info
    const deadline = await fundraiser.deadline();
    const isFinalized = await fundraiser.finalized();
    const currentTime = await ethers.provider.getBlock('latest').then(b => b!.timestamp);

    console.log("Current time:", new Date(currentTime * 1000).toLocaleString());
    console.log("Deadline:", new Date(Number(deadline) * 1000).toLocaleString());
    console.log("Is finalized:", isFinalized);
}

main().catch(console.error); 