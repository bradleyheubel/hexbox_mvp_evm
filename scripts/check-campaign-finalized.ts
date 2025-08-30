import { ethers } from "hardhat";

async function main() {
    // Replace with the campaign address you want to check
    const CAMPAIGN_ADDRESS = "0x2acf4f7216330459cb66e7dcb2d43762e8176d85"
    
    if (!CAMPAIGN_ADDRESS) {
        console.error("Usage: npx hardhat run scripts/check-campaign-finalized.ts --network fuji -- <CAMPAIGN_ADDRESS>");
        process.exit(1);
    }

    console.log(`Checking finalization status for campaign: ${CAMPAIGN_ADDRESS}`);
    console.log("Network: Avalanche Fuji Testnet");
    console.log("=" .repeat(50));

    try {
        // Get contract instance
        const fundraiser = await ethers.getContractAt("USDCFundraiserUpgradeable", CAMPAIGN_ADDRESS);
        
        // Get USDC contract for balance checks
        const FUJI_USDC = "0x5425890298aed601595a70AB815c96711a31Bc65";
        const usdc = await ethers.getContractAt("IERC20", FUJI_USDC);
        
        // Check if campaign is finalized
        const isFinalized = await fundraiser.finalized();
        
        // Get additional campaign info for context
        const deadline = await fundraiser.deadline();
        const totalRaised = await fundraiser.totalRaised();
        const minimumTarget = await fundraiser.minimumTarget();
        const fundingType = await fundraiser.fundingType();
        const currentTime = await ethers.provider.getBlock('latest').then(b => b!.timestamp);
        
        // Display results
        console.log(`Campaign Finalized: ${isFinalized ? '✅ YES' : '❌ NO'}`);
        console.log();
        
        // Additional context
        console.log("Campaign Details:");
        console.log(`- Funding Type: ${getFundingTypeName(Number(fundingType))}`);
        console.log(`- Total Raised: ${ethers.formatUnits(totalRaised, 6)} USDC`);
        console.log(`- Minimum Target: ${ethers.formatUnits(minimumTarget, 6)} USDC`);
        console.log(`- Deadline: ${new Date(Number(deadline) * 1000).toLocaleString()}`);
        console.log(`- Current Time: ${new Date(currentTime * 1000).toLocaleString()}`);
        console.log(`- Deadline Passed: ${currentTime > Number(deadline) ? '✅ YES' : '❌ NO'}`);
        
        if (Number(fundingType) === 0) {
            console.log(`- Target Met: ${totalRaised >= minimumTarget ? '✅ YES' : '❌ NO'}`);
        }
        
        // Provide finalization guidance and attempt finalization
        console.log();
        if (!isFinalized) {
            console.log("Finalization Status:");
            let canFinalize = false;
            let finalizationReason = "";
            
            if (Number(fundingType) === 0) { // All or nothing
                if (currentTime > Number(deadline)) {
                    canFinalize = true;
                    if (totalRaised >= minimumTarget) {
                        console.log("🟢 Campaign can be finalized (deadline passed, target met)");
                        finalizationReason = "deadline passed, target met";
                    } else {
                        console.log("🟡 Campaign can be finalized (deadline passed, target not met - refunds available)");
                        finalizationReason = "deadline passed, target not met";
                    }
                } else {
                    console.log("🔴 Campaign cannot be finalized yet (deadline not reached)");
                }
            } else if (Number(fundingType) === 1) { // Limitless
                canFinalize = true;
                console.log("🟡 Campaign can be finalized by owner at any time (limitless funding)");
                finalizationReason = "limitless funding";
            } else if (Number(fundingType) === 2) { // Flexible
                if (currentTime > Number(deadline)) {
                    canFinalize = true;
                    console.log("🟢 Campaign can be finalized (deadline passed, flexible funding)");
                    finalizationReason = "deadline passed, flexible funding";
                } else {
                    console.log("🔴 Campaign cannot be finalized yet (deadline not reached)");
                }
            }
            
            // Attempt finalization if possible
            if (canFinalize) {
                console.log();
                console.log("🚀 Attempting to finalize campaign...");
                try {
                    const [signer] = await ethers.getSigners();
                    console.log(`Using account: ${signer.address}`);
                    
                    // Estimate gas first
                    const gasEstimate = await fundraiser.finalize.estimateGas();
                    console.log(`Estimated gas: ${gasEstimate.toString()}`);
                    
                    // Attempt finalization
                    const tx = await fundraiser.finalize({
                        gasLimit: gasEstimate * 120n / 100n // Add 20% buffer
                    });
                    
                    console.log(`✅ Finalization transaction sent: ${tx.hash}`);
                    console.log("⏳ Waiting for confirmation...");
                    
                    const receipt = await tx.wait();
                    
                    if (receipt?.status === 1) {
                        console.log("🎉 Campaign successfully finalized!");
                        console.log(`Gas used: ${receipt.gasUsed.toString()}`);
                        
                        // Check if funds were released
                        const finalBalance = await usdc.balanceOf(CAMPAIGN_ADDRESS);
                        console.log(`Remaining contract balance: ${ethers.formatUnits(finalBalance, 6)} USDC`);
                        
                    } else {
                        console.log("❌ Finalization transaction failed");
                    }
                    
                } catch (error: any) {
                    console.log("❌ Finalization failed:");
                    if (error.message.includes("Already finalized")) {
                        console.log("   Campaign is already finalized");
                    } else if (error.message.includes("Only owner")) {
                        console.log("   Only the contract owner can finalize this campaign");
                    } else if (error.message.includes("Deadline not reached")) {
                        console.log("   Deadline has not been reached yet");
                    } else {
                        console.log(`   Error: ${error.message}`);
                    }
                }
            }
        } else {
            console.log("✅ Campaign is already finalized");
        }
        
    } catch (error: any) {
        console.error("Error checking campaign status:");
        if (error.message.includes("call revert exception")) {
            console.error("❌ Invalid contract address or contract not found");
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

function getFundingTypeName(fundingType: number): string {
    switch (fundingType) {
        case 0: return "All or Nothing";
        case 1: return "Limitless";
        case 2: return "Flexible";
        default: return "Unknown";
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
