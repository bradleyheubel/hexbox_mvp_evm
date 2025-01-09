import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

async function main() {
    const FUNDRAISER_ADDRESS = "0xE9145Fada78365E8Ae22B8A44113186a13C6624d";
    const fundraiser = await ethers.getContractAt("USDCFundraiser", FUNDRAISER_ADDRESS);

    // Check current status
    const deadline = await fundraiser.deadline();
    console.log("Current time:", await time.latest());
    console.log("Deadline:", deadline);

    // Simulate time passing
    await time.increaseTo(deadline.add(1));
    console.log("Time increased to after deadline");

    // Check if upkeep is needed
    const { upkeepNeeded } = await fundraiser.checkUpkeep("0x");
    console.log("Upkeep needed:", upkeepNeeded);

    if (upkeepNeeded) {
        // Perform upkeep
        const tx = await fundraiser.performUpkeep("0x");
        await tx.wait();
        console.log("Performed upkeep");
    }
}

main().catch(console.error); 