import { ethers } from "hardhat";
import { ProductToken, USDCFundraiser } from "../typechain-types";
import { IERC20 } from "../typechain-types/@openzeppelin/contracts/token/ERC20";

async function main() {
    // Contract addresses from deployment (replace with your deployed addresses)
    const FUNDRAISER_ADDRESS = "0x0b6D5617435B878A680eCc902f0484929B6Cf0f8"//"0xADcC0a3179d5B8af40B37acd3bC85c35EB1809D8";
    const PRODUCT_TOKEN_ADDRESS = "0x9e00EA412f610a9549789D802D13B36d1d793448"//"0x5467d9F00f83C1Ae540ACA7Aa0581eCc876F1EdA";
    const FUJI_USDC = "0x5425890298aed601595a70AB815c96711a31Bc65";

    console.log("Testing contracts on Fuji...");

    // Get contract instances
    const fundraiser = await ethers.getContractAt("USDCFundraiser", FUNDRAISER_ADDRESS) as USDCFundraiser;
    const productToken = await ethers.getContractAt("ProductToken", PRODUCT_TOKEN_ADDRESS) as ProductToken;
    const usdc = await ethers.getContractAt("IERC20", FUJI_USDC) as IERC20;

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Testing with address:", signer.address);

    try {
        // 1. Check USDC balance
        const usdcBalance = await usdc.balanceOf(signer.address);
        console.log("USDC Balance:", ethers.formatUnits(usdcBalance, 6));

        // 2. Get product price
        const productId = 4; // First product
        const productPrice = await fundraiser.productPrices(productId);
        console.log("Product", productId, "price:", ethers.formatUnits(productPrice, 6), "USDC");

        // 3. Approve USDC spending
        const quantity = 1n;
        const depositAmount = productPrice * quantity;
        console.log("Approving", ethers.formatUnits(depositAmount, 6), "USDC...");
        const approveTx = await usdc.approve(FUNDRAISER_ADDRESS, depositAmount);
        await approveTx.wait();
        console.log("USDC approved");

        // 4. Make deposit
        // console.log("Making deposit for", quantity.toString(), "of product", productId, "...");
        // const depositTx = await fundraiser.deposit(productId, quantity);
        // const depositReceipt = await depositTx.wait();
        // console.log("Deposit successful:", depositReceipt?.hash);

        // 5. Check NFT balance
        const nftBalance = await productToken.balanceOf(signer.address, productId);
        console.log("NFT Balance for product", productId, ":", nftBalance.toString());

        // 6. Check deposit amount
        const depositRecord = await fundraiser.tokenDeposits(productId);
        console.log("Deposit amount recorded:", ethers.formatUnits(depositRecord, 6), "USDC");

        // 7. Check total raised
        const totalRaised = await fundraiser.totalRaised();
        console.log("Total raised:", ethers.formatUnits(totalRaised, 6), "USDC");

        // 8. Check minimum target status
        const minimumTarget = await fundraiser.minimumTarget();
        console.log("Minimum target:", ethers.formatUnits(minimumTarget, 6), "USDC");
        console.log("Progress:", (totalRaised * 100n) / minimumTarget, "%");


        // // Add deadline extension test
        // const timeNow = Math.floor(Date.now() / 1000) + 60;
        // await fundraiser.updateDeadline(timeNow);
        // console.log("Deadline updated to:", new Date(timeNow * 1000).toLocaleString());


        // 9. Test finalize
        // const finalizeTx = await fundraiser.finalize();
        // const finalizeReceipt = await finalizeTx.wait();
        // console.log("Finalize successful:", finalizeReceipt?.hash);

        // 10. Test refund claim if needed
        console.log("\nTesting refund claim...");
        const isFinalized = await fundraiser.finalized();
        const targetMet = totalRaised >= minimumTarget;
        const fundingType = await fundraiser.fundingType();

        console.log("Is finalized:", isFinalized);
        console.log("Target met:", targetMet);
        console.log("Funding type:", fundingType);


        // if (isFinalized && !targetMet) {
            console.log("Conditions met for refund. Attempting to claim...");
            const refundQuantity = 1n;
            const refundTx = await fundraiser.claimRefund(productId, refundQuantity);
            const refundReceipt = await refundTx.wait();
            console.log("Refund claimed:", refundReceipt?.hash);

            // Verify NFT was burned
            const nftBalanceAfterRefund = await productToken.balanceOf(signer.address, productId);
            console.log("NFT Balance after refund:", nftBalanceAfterRefund.toString());

            // Check USDC balance after refund
            const usdcBalanceAfterRefund = await usdc.balanceOf(signer.address);
            console.log("USDC Balance after refund:", ethers.formatUnits(usdcBalanceAfterRefund, 6));
       
            const totalRaisedAfterRefund = await fundraiser.totalRaised();
            console.log("Total raised after refund:", ethers.formatUnits(totalRaisedAfterRefund, 6), "USDC");
            // } else {
        //     console.log("Refund conditions not met:");
        //     console.log("- Finalized:", isFinalized);
        //     console.log("- Target met:", targetMet);
        // }

            // Check beneficiary balance
            const beneficiaryWallet = await fundraiser.beneficiaryWallet();
            const beneficiaryBalance = await usdc.balanceOf(beneficiaryWallet);
            console.log("Beneficiary balance:", ethers.formatUnits(beneficiaryBalance, 6), "USDC");
        // } else {
        //     console.log("Minimum target not met yet");
        // }

    } catch (error) {
        console.error("Error during testing:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 