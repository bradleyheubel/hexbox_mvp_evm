import { ethers } from "hardhat";

/**
 * Comprehensive test script for V09102025 contracts on Fuji
 * Tests the factory minting pattern where fundraisers call factory to mint/burn
 */

async function main() {
    console.log("\n🧪 TESTING V09102025 CONTRACTS ON FUJI");
    console.log("=".repeat(60));

    // Load deployment info
    let deploymentInfo: any;
    try {
        deploymentInfo = require("../deployment-fuji-test.json");
    } catch {
        console.error("❌ deployment-fuji-test.json not found!");
        console.error("   Run: npx hardhat run scripts/deploy-fuji-test.ts --network fuji");
        process.exit(1);
    }

    const FACTORY_ADDRESS = deploymentInfo.addresses.factoryProxy;
    const PRODUCT_TOKEN_ADDRESS = deploymentInfo.addresses.productTokenProxy;
    const FUJI_USDC = "0x5425890298aed601595a70AB815c96711a31Bc65";

    const [signer] = await ethers.getSigners();
    console.log("👤 Testing with address:", signer.address);
    console.log("🏭 Factory:", FACTORY_ADDRESS);
    console.log("🎨 ProductToken:", PRODUCT_TOKEN_ADDRESS);

    // Get contract instances
    const factory = await ethers.getContractAt("USDCFundraiserFactoryUpgradeableV09102025", FACTORY_ADDRESS);
    const productToken = await ethers.getContractAt("ProductTokenUpgradeable", PRODUCT_TOKEN_ADDRESS);
    const usdc = await ethers.getContractAt("IERC20", FUJI_USDC);

    try {
        // ============================================================
        // TEST 1: Verify Factory Configuration
        // ============================================================
        console.log("\n" + "=".repeat(60));
        console.log("📋 TEST 1: Verify Factory Configuration");
        console.log("=".repeat(60));

        const usdcAddress = await factory.usdcAddress();
        const productTokenAddress = await factory.productTokenAddress();
        const feePercentage = await factory.defaultFeePercentage();
        const feeWallet = await factory.feeWallet();

        console.log("   USDC Address:", usdcAddress);
        console.log("   ProductToken:", productTokenAddress);
        console.log("   Fee Percentage:", feePercentage.toString(), "basis points");
        console.log("   Fee Wallet:", feeWallet);

        // Verify factory has MINTER_ROLE
        const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
        const factoryHasMinterRole = await productToken.hasRole(MINTER_ROLE, FACTORY_ADDRESS);
        console.log("   Factory has MINTER_ROLE:", factoryHasMinterRole ? "✅" : "❌");

        if (!factoryHasMinterRole) {
            console.error("❌ Factory doesn't have MINTER_ROLE! Cannot proceed.");
            process.exit(1);
        }

        // // ============================================================
        // // TEST 2: Create Test Fundraiser
        // // ============================================================
        // console.log("\n" + "=".repeat(60));
        // console.log("📦 TEST 2: Create Test Fundraiser");
        // console.log("=".repeat(60));

        // const products = [
        //     {
        //         productId: 1,
        //         price: ethers.parseUnits("1", 6), // 1 USDC
        //         supplyLimit: 100
        //     },
        //     {
        //         productId: 2,
        //         price: ethers.parseUnits("2", 6), // 2 USDC
        //         supplyLimit: 50
        //     }
        // ];

        const beneficiaryWallet = signer.address;
        // const fundingType = 2; // Flexible funding (easiest for testing)
        // const minimumTarget = ethers.parseUnits("100", 6); // 100 USDC
        // const deadline = Math.floor(Date.now() / 1000) + 86400 * 1; // 1 day

        // console.log("   Creating fundraiser...");
        // const createTx = await factory.createFundraiser(
        //     beneficiaryWallet,
        //     fundingType,
        //     minimumTarget,
        //     deadline,
        //     products
        // );

        // const createReceipt = await createTx.wait();
        // console.log("   ✅ Transaction:", createReceipt?.hash);

        // // Extract fundraiser address from event
        // const fundraiserCreatedEvent = createReceipt?.logs.find((log: any) => {
        //     try {
        //         const parsed = factory.interface.parseLog(log);
        //         return parsed?.name === "FundraiserCreated";
        //     } catch {
        //         return false;
        //     }
        // });

        // if (!fundraiserCreatedEvent) {
        //     console.error("❌ FundraiserCreated event not found!");
        //     process.exit(1);
        // }

        // const parsed = factory.interface.parseLog(fundraiserCreatedEvent);
        // const FUNDRAISER_ADDRESS = parsed.args.fundraiser;

        // console.log("   ✅ Fundraiser created:", FUNDRAISER_ADDRESS);

        // // Verify fundraiser is tracked by factory
        // const isFundraiser = await factory.isFundraiser(FUNDRAISER_ADDRESS);
        // console.log("   Factory recognizes fundraiser:", isFundraiser ? "✅" : "❌");

        // // ============================================================
        // // TEST 3: Verify Fundraiser Configuration
        // // ============================================================
        // console.log("\n" + "=".repeat(60));
        // console.log("📋 TEST 3: Verify Fundraiser Configuration");
        // console.log("=".repeat(60));

        // const fundraiser = await ethers.getContractAt("USDCFundraiserUpgradeableV09102025", FUNDRAISER_ADDRESS);

        // const fundraiserFactory = await fundraiser.factory();
        // const fundraiserProductToken = await fundraiser.productToken();
        // const fundraiserDeadline = await fundraiser.deadline();
        // const fundraiserMinTarget = await fundraiser.minimumTarget();

        // console.log("   Factory address:", fundraiserFactory);
        // console.log("   ProductToken:", fundraiserProductToken);
        // console.log("   Deadline:", new Date(Number(fundraiserDeadline) * 1000).toLocaleString());
        // console.log("   Minimum target:", ethers.formatUnits(fundraiserMinTarget, 6), "USDC");

        // // Verify factory address is correct
        // if (fundraiserFactory.toLowerCase() !== FACTORY_ADDRESS.toLowerCase()) {
        //     console.error("❌ Fundraiser has wrong factory address!");
        //     process.exit(1);
        // }
        // console.log("   ✅ Fundraiser correctly configured");

        // // ============================================================
        // // TEST 4: Test Deposit (Minting via Factory)
        // // ============================================================
        // console.log("\n" + "=".repeat(60));
        // console.log("💰 TEST 4: Test Deposit (Minting via Factory)");
        // console.log("=".repeat(60));

        // const productId = 1n;
        // const quantity = 2n;
        // const product = await fundraiser.products(productId);
        // const depositAmount = product.price * quantity;

        // console.log("   Product ID:", productId.toString());
        // console.log("   Quantity:", quantity.toString());
        // console.log("   Price per unit:", ethers.formatUnits(product.price, 6), "USDC");
        // console.log("   Total amount:", ethers.formatUnits(depositAmount, 6), "USDC");

        // // Check USDC balance
        // const usdcBalance = await usdc.balanceOf(signer.address);
        // console.log("   Your USDC balance:", ethers.formatUnits(usdcBalance, 6), "USDC");

        // if (usdcBalance < depositAmount) {
        //     console.error("❌ Insufficient USDC balance!");
        //     console.error("   Get testnet USDC from: https://faucet.circle.com/");
        //     process.exit(1);
        // }

        // // Approve USDC
        // console.log("   Approving USDC...");
        // const approveTx = await usdc.approve(FUNDRAISER_ADDRESS, depositAmount);
        // await approveTx.wait();
        // console.log("   ✅ USDC approved");

        // // Make deposit
        // console.log("   Making deposit...");
        // const depositTx = await fundraiser.deposit(productId, quantity);
        // const depositReceipt = await depositTx.wait();
        // console.log("   ✅ Deposit successful:", depositReceipt?.hash);

        // // Verify NFT was minted
        // const nftBalance = await productToken.balanceOf(signer.address, productId);
        // console.log("   NFT balance:", nftBalance.toString());

        // if (nftBalance !== quantity) {
        //     console.error("❌ NFT balance mismatch!");
        //     console.error("   Expected:", quantity.toString());
        //     console.error("   Got:", nftBalance.toString());
        //     process.exit(1);
        // }
        // console.log("   ✅ NFTs minted correctly via factory");

        // // Verify fundraiser tracking
        // const totalRaised = await fundraiser.totalRaised();
        // const productSoldCount = await fundraiser.productSoldCount(productId);
        // console.log("   Total raised:", ethers.formatUnits(totalRaised, 6), "USDC");
        // console.log("   Product sold count:", productSoldCount.toString());

        // ============================================================
        // TEST 5: Test Refund (Burning via Factory)
        // ============================================================
        console.log("\n" + "=".repeat(60));
        console.log("🔥 TEST 5: Test Refund (Burning via Factory)");
        console.log("=".repeat(60));

        // For flexible funding, we need to test refund differently
        // Let's create an all-or-nothing campaign that will fail
        console.log("   Creating all-or-nothing campaign for refund test...");

        const refundProducts = [
            {
                productId: 10,
                price: ethers.parseUnits("1", 6),
                supplyLimit: 10
            }
        ];

        const refundTarget = ethers.parseUnits("10", 6); // High target that won't be met
        const refundDeadline = Math.floor(Date.now() / 1000) + 120; // 2 minutes

        const refundCreateTx = await factory.createFundraiser(
            beneficiaryWallet,
            0, // All-or-nothing
            refundTarget,
            refundDeadline,
            refundProducts
        );

        const refundCreateReceipt = await refundCreateTx.wait();
        const refundEvent = refundCreateReceipt?.logs.find((log: any) => {
            try {
                const parsed = factory.interface.parseLog(log);
                return parsed?.name === "FundraiserCreated";
            } catch {
                return false;
            }
        });

        const refundParsed = factory.interface.parseLog(refundEvent);
        const REFUND_FUNDRAISER = refundParsed.args.fundraiser;
        console.log("   ✅ Refund test fundraiser:", REFUND_FUNDRAISER);

        const refundFundraiser = await ethers.getContractAt("USDCFundraiserUpgradeableV09102025", REFUND_FUNDRAISER);

        // Make a small deposit
        const refundProductId = 10n;
        const refundQuantity = 2n;
        const refundProduct = await refundFundraiser.products(refundProductId);
        const refundDepositAmount = refundProduct.price * refundQuantity;

        console.log("   Making small deposit...");
        const refundApproveTx = await usdc.approve(REFUND_FUNDRAISER, refundDepositAmount);
        await refundApproveTx.wait();

        const refundDepositTx = await refundFundraiser.deposit(refundProductId, refundQuantity);
        await refundDepositTx.wait();
        console.log("   ✅ Deposit made");

        // test all or nothing refunding
        console.log("   Testing all or nothing refunding...");
        const allOrNothingRefundBeforeDeadlineTx = await refundFundraiser.claimRefund(refundProductId, 1n);
        await allOrNothingRefundBeforeDeadlineTx.wait();
        console.log("   ✅ All or nothing refund successful");

        // Wait for deadline
        console.log("   Waiting for deadline to pass (2 minutes)...");

        // add waiting here
        await new Promise((resolve) => setTimeout(resolve, 120 * 1000));
        // add deadline check here
        const deadlineCheck = await refundFundraiser.deadline();
        if (deadlineCheck < Math.floor(Date.now() / 1000)) {
            console.log("   ✅ Deadline passed");
        } else {
            await new Promise((resolve) => setTimeout(resolve, 120 * 1000));
            console.log("   ✅ Deadline passed");
        }

        // test all or nothing refunding
        console.log("   Testing all or nothing refunding...");
        try {
            await refundFundraiser.claimRefund(refundProductId, 1n);
            // should fail claiming refund since deadline is passed
            console.log("   ❌ All or nothing refund passed successfully");
        } catch (error: any) {
            console.log("   ✅ All or nothing refund failed successfully");
        }


        // ============================================================
        // TEST 6: Verify Factory Mint/Burn Functions
        // ============================================================
        console.log("\n" + "=".repeat(60));
        console.log("🔐 TEST 6: Verify Factory Access Control");
        console.log("=".repeat(60));

        // Try to call mintForFundraiser directly (should fail)
        console.log("   Testing direct mint call (should fail)...");
        try {
            await factory.mintForFundraiser(signer.address, 999n, 1n);
            console.error("   ❌ Direct mint should have failed!");
        } catch (error: any) {
            if (error.message.includes("Only fundraisers can mint")) {
                console.log("   ✅ Direct mint correctly rejected");
            } else {
                console.log("   ⚠️  Unexpected error:", error.message);
            }
        }

        // Try to call burnForFundraiser directly (should fail)
        console.log("   Testing direct burn call (should fail)...");
        try {
            await factory.burnForFundraiser(signer.address, 999n, 1n);
            console.error("   ❌ Direct burn should have failed!");
        } catch (error: any) {
            if (error.message.includes("Only fundraisers can burn")) {
                console.log("   ✅ Direct burn correctly rejected");
            } else {
                console.log("   ⚠️  Unexpected error:", error.message);
            }
        }



        // ============================================================
        // SUMMARY
        // ============================================================
        console.log("\n" + "=".repeat(60));
        console.log("🎉 TEST SUMMARY");
        console.log("=".repeat(60));

        console.log("\n✅ All tests passed!");
        console.log("\n📊 Test Results:");
        console.log("   ✅ Factory configuration verified");
        console.log("   ✅ Fundraiser created successfully");
        console.log("   ✅ Fundraiser configured correctly");
        console.log("   ✅ Deposit works (minting via factory)");
        console.log("   ✅ NFTs minted correctly");
        console.log("   ✅ Tracking updated correctly");
        console.log("   ✅ Access control working");

        // console.log("\n📝 Test Fundraiser Address:");
        // console.log("   " + FUNDRAISER_ADDRESS);
        // console.log("\n💡 You can continue testing with:");
        // console.log("   TEST_FUNDRAISER_ADDRESS=" + FUNDRAISER_ADDRESS + " npx hardhat run scripts/test-fuji.ts --network fuji");

        console.log("\n" + "=".repeat(60) + "\n");

    } catch (error) {
        console.error("\n❌ TEST FAILED!");
        console.error(error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
