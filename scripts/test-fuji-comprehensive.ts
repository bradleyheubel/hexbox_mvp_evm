import { ethers } from "hardhat";
import { FUJI_CONFIG } from "./fuji-config";

/**
 * Comprehensive Test Suite for Fuji Deployment
 * 
 * Tests:
 * 1. Basic Functionality
 * 2. Security Vulnerabilities (Cross-Campaign Refund Exploit)
 * 3. Price Change Protection
 * 4. Access Control
 * 5. Edge Cases
 */

// Load deployment info
let deploymentInfo: any;
try {
  deploymentInfo = require("../deployment-fuji-test.json");
} catch {
  console.error("❌ deployment-fuji-test.json not found!");
  console.error("   Run: npx hardhat run scripts/deploy-fuji-test.ts --network fuji");
  process.exit(1);
}

const USDC_ADDRESS = FUJI_CONFIG.tokens.usdc;

async function main() {
  console.log("\n🧪 COMPREHENSIVE FUJI TEST SUITE");
  console.log("=".repeat(80));
  
  const [deployer, user1, user2] = await ethers.getSigners();
  console.log("👤 Deployer:", deployer.address);
  console.log("👤 User 1:", user1.address);
  console.log("👤 User 2:", user2.address);

  // Verify network
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== BigInt(43113)) {
    console.error("❌ Not on Fuji testnet!");
    process.exit(1);
  }

  // Load contracts
  const factory = await ethers.getContractAt(
    "USDCFundraiserFactoryUpgradeable",
    deploymentInfo.addresses.factoryProxy
  );

  const productToken = await ethers.getContractAt(
    "ProductTokenUpgradeable",
    deploymentInfo.addresses.productTokenProxy
  );

  const usdc = await ethers.getContractAt(
    "IERC20",
    USDC_ADDRESS
  );

  let testsPassed = 0;
  let testsFailed = 0;
  const failedTests: string[] = [];

  // ============================================================
  // TEST 1: Verify Deployment Configuration
  // ============================================================
  console.log("\n" + "=".repeat(80));
  console.log("📋 TEST 1: Verify Deployment Configuration");
  console.log("=".repeat(80));

  try {
    const factoryOwner = await factory.owner();
    const usdcAddress = await factory.usdcAddress();
    const productTokenAddress = await factory.productTokenAddress();
    const feePercentage = await factory.defaultFeePercentage();
    const feeWallet = await factory.feeWallet();

    console.log("   Factory Owner:", factoryOwner);
    console.log("   USDC Address:", usdcAddress);
    console.log("   ProductToken:", productTokenAddress);
    console.log("   Fee Percentage:", feePercentage.toString(), "basis points");
    console.log("   Fee Wallet:", feeWallet);

    if (usdcAddress.toLowerCase() === USDC_ADDRESS.toLowerCase() &&
        productTokenAddress.toLowerCase() === deploymentInfo.addresses.productTokenProxy.toLowerCase()) {
      console.log("✅ TEST 1 PASSED: Configuration correct");
      testsPassed++;
    } else {
      throw new Error("Configuration mismatch");
    }
  } catch (error) {
    console.error("❌ TEST 1 FAILED:", error);
    testsFailed++;
    failedTests.push("Test 1: Deployment Configuration");
  }

  // ============================================================
  // TEST 2: Verify MINTER_ROLE
  // ============================================================
  console.log("\n" + "=".repeat(80));
  console.log("🔐 TEST 2: Verify MINTER_ROLE Configuration");
  console.log("=".repeat(80));

  try {
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const factoryHasMinter = await productToken.hasRole(MINTER_ROLE, deploymentInfo.addresses.factoryProxy);

    console.log("   Factory has MINTER_ROLE:", factoryHasMinter);

    if (factoryHasMinter) {
      console.log("✅ TEST 2 PASSED: MINTER_ROLE correctly configured");
      testsPassed++;
    } else {
      throw new Error("Factory does not have MINTER_ROLE");
    }
  } catch (error) {
    console.error("❌ TEST 2 FAILED:", error);
    testsFailed++;
    failedTests.push("Test 2: MINTER_ROLE Configuration");
  }

  // ============================================================
  // TEST 3: Create Two Campaigns with Same Product IDs
  // ============================================================
  console.log("\n" + "=".repeat(80));
  console.log("🏭 TEST 3: Create Two Campaigns (Setup for Exploit Test)");
  console.log("=".repeat(80));

  let campaignA: any;
  let campaignB: any;
  let uniqueProductIdA: bigint;
  let uniqueProductIdB: bigint;

  try {
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60 * 2; // 2 hours

    // Campaign A: Product ID 1 at 1 USDC
    console.log("\n   Creating Campaign A (Product 1 @ 1 USDC)...");
    const txA = await factory.connect(user1).createFundraiser(
      user1.address, // beneficiary
      2, // funding type: flexible
      ethers.parseUnits("5", 6), // minimum target: 5 USDC
      deadline,
      [
        {
          productId: 1,
          price: ethers.parseUnits("1", 6),
          supplyLimit: 100
        }
      ]
    );
    const receiptA = await txA.wait();
    
    // Get campaign address from event
    const eventA = receiptA?.logs.find((log: any) => {
      try {
        return factory.interface.parseLog(log)?.name === "FundraiserCreated";
      } catch {
        return false;
      }
    });
    const campaignAddressA = eventA ? factory.interface.parseLog(eventA)?.args[0] : null;
    
    if (!campaignAddressA) throw new Error("Campaign A address not found");
    
    campaignA = await ethers.getContractAt("USDCFundraiserUpgradeable", campaignAddressA);
    console.log("   ✅ Campaign A created:", campaignAddressA);

    // Get unique product ID for Campaign A
    uniqueProductIdA = await campaignA.getUniqueProductId(1);
    console.log("   Campaign A Product ID 1 → Unique ID:", uniqueProductIdA.toString());

    // Campaign B: Product ID 1 at 5 USDC (5x more expensive!)
    console.log("\n   Creating Campaign B (Product 1 @ 5 USDC)...");
    const txB = await factory.connect(user2).createFundraiser(
      user2.address, // beneficiary
      2, // funding type: flexible
      ethers.parseUnits("10", 6), // minimum target: 10 USDC
      deadline,
      [
        {
          productId: 1, // Same original ID as Campaign A!
          price: ethers.parseUnits("5", 6), // 5x more expensive
          supplyLimit: 50
        }
      ]
    );
    const receiptB = await txB.wait();
    
    const eventB = receiptB?.logs.find((log: any) => {
      try {
        return factory.interface.parseLog(log)?.name === "FundraiserCreated";
      } catch {
        return false;
      }
    });
    const campaignAddressB = eventB ? factory.interface.parseLog(eventB)?.args[0] : null;
    
    if (!campaignAddressB) throw new Error("Campaign B address not found");
    
    campaignB = await ethers.getContractAt("USDCFundraiserUpgradeable", campaignAddressB);
    console.log("   ✅ Campaign B created:", campaignAddressB);

    // Get unique product ID for Campaign B
    uniqueProductIdB = await campaignB.getUniqueProductId(1);
    console.log("   Campaign B Product ID 1 → Unique ID:", uniqueProductIdB.toString());

    // Verify unique IDs are different
    if (uniqueProductIdA !== uniqueProductIdB) {
      console.log("\n✅ TEST 3 PASSED: Campaigns created with unique product IDs");
      console.log("   Unique IDs are different:", uniqueProductIdA !== uniqueProductIdB);
      testsPassed++;
    } else {
      throw new Error("Product IDs are not unique!");
    }
  } catch (error) {
    console.error("❌ TEST 3 FAILED:", error);
    testsFailed++;
    failedTests.push("Test 3: Create Campaigns");
    // Can't continue without campaigns
    console.log("\n⚠️  Cannot continue tests without campaigns. Exiting...");
    printSummary(testsPassed, testsFailed, failedTests);
    process.exit(1);
  }

  // ============================================================
  // TEST 4: Cross-Campaign Refund Exploit (Should Fail)
  // ============================================================
  console.log("\n" + "=".repeat(80));
  console.log("🔒 TEST 4: Cross-Campaign Refund Exploit Prevention");
  console.log("=".repeat(80));

  try {
    // console.log("\n   Step 1: Get USDC from faucet for user1...");
    // console.log("   ⚠️  MANUAL ACTION REQUIRED:");
    // console.log("   1. Go to: https://faucet.circle.com/");
    // console.log("   2. Select 'Avalanche Fuji'");
    // console.log("   3. Enter address:", user1.address);
    // console.log("   4. Request USDC");
    // console.log("\n   Waiting 30 seconds for you to get USDC...");
    // await new Promise(resolve => setTimeout(resolve, 30000));

    const user1Balance = await usdc.balanceOf(user1.address);
    console.log("   User1 USDC Balance:", ethers.formatUnits(user1Balance, 6), "USDC");

    if (user1Balance < ethers.parseUnits("3", 6)) {
      throw new Error("Insufficient USDC balance. Please get USDC from faucet.");
    }
    console.log("\n   Step 2: User1 buys from Campaign A (1 USDC)...");
    const approveTx = await usdc.connect(user1).approve(campaignA.target, ethers.parseUnits("1", 6));
    await approveTx.wait();
    console.log("   ✅ Approved USDC for Campaign A");
    console.log("   📝 Approval TX: https://testnet.snowtrace.io/tx/" + approveTx.hash);
    
    const depositTx = await campaignA.connect(user1).deposit(1, 1);  // Use original product ID
    await depositTx.wait();
    console.log("   ✅ Purchase successful");
    console.log("   📝 Deposit TX: https://testnet.snowtrace.io/tx/" + depositTx.hash);

    // Check NFT balance
    const nftBalance = await productToken.balanceOf(user1.address, uniqueProductIdA);
    console.log("   User1 NFT Balance (Campaign A):", nftBalance.toString());

    console.log("\n   Step 3: Attempt to refund from Campaign B (should fail)...");
    try {
      await campaignB.connect(user1).claimRefund(1, 1);  // Use original product ID
      throw new Error("Exploit succeeded - this should not happen!");
    } catch (error: any) {
      if (error.message.includes("Insufficient NFT balance") || 
          error.message.includes("Invalid product")) {
        console.log("   ✅ Refund correctly rejected");
        console.log("   Error:", error.message.split('\n')[0]);
        console.log("\n✅ TEST 4 PASSED: Cross-campaign refund exploit prevented");
        testsPassed++;
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error("❌ TEST 4 FAILED:", error);
    testsFailed++;
    failedTests.push("Test 4: Cross-Campaign Refund Exploit");
  }

  // ============================================================
  // TEST 5: Price Change Protection
  // ============================================================
  console.log("\n" + "=".repeat(80));
  console.log("🔒 TEST 5: Price Change Protection After Sales");
  console.log("=".repeat(80));

  try {
    console.log("\n   Step 1: Verify product sold count...");
    const soldCount = await campaignA.productSoldCount(1);
    console.log("   Products sold:", soldCount.toString());

    console.log("\n   Step 2: Attempt to change price (should fail)...");
    try {
      const updateTx = await campaignA.connect(user1).updateProduct(
        1, // original product ID
        ethers.parseUnits("2", 6), // try to change to 2 USDC
        100 // keep supply limit
      );
      await updateTx.wait();
      console.log("   📝 Update TX: https://testnet.snowtrace.io/tx/" + updateTx.hash);
      throw new Error("Price change succeeded - this should not happen!");
    } catch (error: any) {
      if (error.message.includes("Cannot change price after sales")) {
        console.log("   ✅ Price change correctly rejected");
        console.log("   Error:", error.message.split('\n')[0]);
        console.log("\n✅ TEST 5 PASSED: Price change protection working");
        testsPassed++;
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error("❌ TEST 5 FAILED:", error);
    testsFailed++;
    failedTests.push("Test 5: Price Change Protection");
  }

  // ============================================================
  // TEST 6: Legitimate Refund (Should Work)
  // ============================================================
  console.log("\n" + "=".repeat(80));
  console.log("✅ TEST 6: Legitimate Refund from Correct Campaign");
  console.log("=".repeat(80));

  try {
    console.log("\n   Step 1: Check user1 balances before refund...");
    const usdcBefore = await usdc.balanceOf(user1.address);
    const nftBefore = await productToken.balanceOf(user1.address, 1);
    console.log("   USDC Balance:", ethers.formatUnits(usdcBefore, 6));
    console.log("   NFT Balance:", nftBefore.toString());

    console.log("\n   Step 2: Refund from Campaign A (correct campaign)...");
    const refundTx = await campaignA.connect(user1).claimRefund(1, 1);  // Use original product ID
    await refundTx.wait();
    console.log("   ✅ Refund successful");
    console.log("   📝 Refund TX: https://testnet.snowtrace.io/tx/" + refundTx.hash);

    console.log("\n   Step 3: Check balances after refund...");
    const usdcAfter = await usdc.balanceOf(user1.address);
    const nftAfter = await productToken.balanceOf(user1.address, 1);
    console.log("   USDC Balance:", ethers.formatUnits(usdcAfter, 6));
    console.log("   NFT Balance:", nftAfter.toString());

    const refundAmount = usdcAfter - usdcBefore;
    console.log("   Refund Amount:", ethers.formatUnits(refundAmount, 6), "USDC");

    // Verify refund amount (should be ~0.975 USDC after 2.5% fee)
    const expectedRefund = ethers.parseUnits("0.975", 6); // 1 - 2.5% fee
    const tolerance = ethers.parseUnits("0.01", 6); // 0.01 USDC tolerance

    if (nftAfter === 0n && refundAmount >= expectedRefund - tolerance && refundAmount <= expectedRefund + tolerance) {
      console.log("\n✅ TEST 6 PASSED: Legitimate refund works correctly");
      testsPassed++;
    } else {
      throw new Error("Refund amount or NFT balance incorrect");
    }
  } catch (error) {
    console.error("❌ TEST 6 FAILED:", error);
    testsFailed++;
    failedTests.push("Test 6: Legitimate Refund");
  }

  // ============================================================
  // TEST 7: Supply Limit Changes (Should Work)
  // ============================================================
  console.log("\n" + "=".repeat(80));
  console.log("✅ TEST 7: Supply Limit Changes After Sales");
  console.log("=".repeat(80));

  try {
    console.log("\n   Step 1: Get current product config...");
    const productBefore = await campaignA.getProduct(1);
    console.log("   Current Supply Limit:", productBefore.supplyLimit.toString());

    console.log("\n   Step 2: Increase supply limit (should work)...");
    const updateSupplyTx = await campaignA.connect(user1).updateProduct(
      1, // original product ID
      productBefore.price, // keep same price
      200 // increase supply limit
    );
    await updateSupplyTx.wait();
    console.log("   ✅ Supply limit update successful");
    console.log("   📝 Supply limit update TX: https://testnet.snowtrace.io/tx/" + updateSupplyTx.hash);

    const productAfter = await campaignA.getProduct(1);
    console.log("   New Supply Limit:", productAfter.supplyLimit.toString());

    if (productAfter.supplyLimit === 200n && productAfter.price === productBefore.price) {
      console.log("\n✅ TEST 7 PASSED: Supply limit changes work correctly");
      testsPassed++;
    } else {
      throw new Error("Supply limit or price incorrect");
    }
  } catch (error) {
    console.error("❌ TEST 7 FAILED:", error);
    testsFailed++;
    failedTests.push("Test 7: Supply Limit Changes");
  }

  // ============================================================
  // TEST 8: Access Control - Unauthorized Actions
  // ============================================================
  console.log("\n" + "=".repeat(80));
  console.log("🔒 TEST 8: Access Control - Unauthorized Actions");
  console.log("=".repeat(80));

  try {
    console.log("\n   Step 1: Attempt unauthorized product update...");
    try {
      const unauthorizedTx = await campaignA.connect(user2).updateProduct(1, ethers.parseUnits("10", 6), 100);
      await unauthorizedTx.wait();
      console.log("   📝 TX: https://testnet.snowtrace.io/tx/" + unauthorizedTx.hash);
      throw new Error("Unauthorized update succeeded - this should not happen!");
    } catch (error: any) {
      if (error.message.includes("Not authorized")) {
        console.log("   ✅ Unauthorized update correctly rejected");
      } else {
        console.log("   Error:", error.message)
        throw error;
      }
    }

    console.log("\n   Step 2: Attempt unauthorized pause by user1...");
    // Verify the owner is the factory owner, not user1
    const campaignOwner = await campaignA.owner();
    const factoryOwner = await factory.owner();
    console.log("   Campaign owner:", campaignOwner);
    console.log("   Factory owner:", factoryOwner);
    console.log("   Deployer owner:", deployer.address);
    console.log("   User1:", user1.address);
    console.log("   User2:", user2.address);
    
    if (campaignOwner.toLowerCase() !== factoryOwner.toLowerCase()) {
      throw new Error("Campaign owner should be factory owner!");
    }
    
    try {
      await campaignA.connect(user1).pause();
      throw new Error("Unauthorized pause by user1 succeeded - this should not happen!");
    } catch (error: any) {
      // OpenZeppelin v5 uses custom errors, check for OwnableUnauthorizedAccount
      const errorStr = error.toString();
      if (error.data && error.data.startsWith("0x118cdaa7")) {
        // 0x118cdaa7 is the selector for OwnableUnauthorizedAccount(address)
        console.log("   ✅ User1 pause correctly rejected (OwnableUnauthorizedAccount)");
      } else if (errorStr.includes("OwnableUnauthorizedAccount") || 
                 errorStr.includes("Not authorized")) {
        console.log("   ✅ User1 pause correctly rejected");
      } else {
        throw error;
      }
    }
    
    console.log("\n   Step 3: Attempt unauthorized pause by user2...");
    try {
      await campaignA.connect(user2).pause();
      throw new Error("Unauthorized pause by user2 succeeded - this should not happen!");
    } catch (error: any) {
      const errorStr = error.toString();
      if (error.data && error.data.startsWith("0x118cdaa7")) {
        console.log("   ✅ User2 pause correctly rejected (OwnableUnauthorizedAccount)");
      } else if (errorStr.includes("OwnableUnauthorizedAccount") || 
                 errorStr.includes("Not authorized")) {
        console.log("   ✅ User2 pause correctly rejected");
      } else {
        throw error;
      }
    }

    console.log("\n✅ TEST 8 PASSED: Access control working correctly");
    testsPassed++;
  } catch (error) {
    console.error("❌ TEST 8 FAILED:", error);
    testsFailed++;
    failedTests.push("Test 8: Access Control");
  }

  // ============================================================
  // TEST 9: NFT Transfer and Refund by New Owner
  // ============================================================
  console.log("\n" + "=".repeat(80));
  console.log("🔄 TEST 9: NFT Transfer and Refund by New Owner");
  console.log("=".repeat(80));

  try {
    console.log("\n   Step 1: User1 buys another NFT from Campaign A...");
    const approve2Tx = await usdc.connect(user1).approve(campaignA.target, ethers.parseUnits("1", 6));
    await approve2Tx.wait();
    console.log("   ✅ Approved USDC");
    console.log("   📝 Approval TX: https://testnet.snowtrace.io/tx/" + approve2Tx.hash);
    
    const deposit2Tx = await campaignA.connect(user1).deposit(1, 1);  // Use original product ID
    await deposit2Tx.wait();
    console.log("   ✅ Purchase successful");
    console.log("   📝 Deposit TX: https://testnet.snowtrace.io/tx/" + deposit2Tx.hash);

    console.log("\n   Step 2: User1 transfers NFT to User2...");
    // Get the unique product ID for the transfer
    const uniqueProductId = await campaignA.getUniqueProductId(1);
    console.log("   Unique Product ID:", uniqueProductId.toString());
    
    const transferTx = await productToken.connect(user1).safeTransferFrom(
      user1.address,
      user2.address,
      uniqueProductId,  // Use unique product ID for transfer
      1,
      "0x"
    );
    await transferTx.wait();
    console.log("   ✅ Transfer successful");
    console.log("   📝 Transfer TX: https://testnet.snowtrace.io/tx/" + transferTx.hash);

    const user2NftBalance = await productToken.balanceOf(user2.address, uniqueProductId);
    console.log("   User2 NFT Balance:", user2NftBalance.toString());

    console.log("\n   Step 3: Get USDC for user2 (for gas)...");
    console.log("   ⚠️  MANUAL ACTION REQUIRED:");
    console.log("   Get USDC for user2:", user2.address);
    console.log("   Waiting 20 seconds...");
    await new Promise(resolve => setTimeout(resolve, 20000));

    console.log("\n   Step 4: User2 refunds the NFT...");
    const user2UsdcBefore = await usdc.balanceOf(user2.address);
    const refund2Tx = await campaignA.connect(user2).claimRefund(1, 1);  // Use original product ID
    await refund2Tx.wait();
    console.log("   📝 Refund TX: https://testnet.snowtrace.io/tx/" + refund2Tx.hash);
    const user2UsdcAfter = await usdc.balanceOf(user2.address);
    
    const refundAmount = user2UsdcAfter - user2UsdcBefore;
    console.log("   ✅ Refund successful");
    console.log("   Refund Amount:", ethers.formatUnits(refundAmount, 6), "USDC");

    if (refundAmount > 0n) {
      console.log("\n✅ TEST 9 PASSED: NFT transfer and refund by new owner works");
      testsPassed++;
    } else {
      throw new Error("Refund amount is zero");
    }
  } catch (error) {
    console.error("❌ TEST 9 FAILED:", error);
    testsFailed++;
    failedTests.push("Test 9: NFT Transfer and Refund");
  }

  // ============================================================
  // Print Summary
  // ============================================================
  printSummary(testsPassed, testsFailed, failedTests);
}

function printSummary(passed: number, failed: number, failedTests: string[]) {
  console.log("\n" + "=".repeat(80));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(80));
  
  const total = passed + failed;
  console.log(`\n   Total Tests: ${total}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  if (failedTests.length > 0) {
    console.log("\n   Failed Tests:");
    failedTests.forEach(test => console.log(`   - ${test}`));
  }

  console.log("\n" + "=".repeat(80));
  
  if (failed === 0) {
    console.log("🎉 ALL TESTS PASSED! Deployment is secure and functional.");
  } else {
    console.log("⚠️  SOME TESTS FAILED. Please review and fix issues.");
  }
  
  console.log("=".repeat(80) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
