import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MockUSDC, USDCFundraiser, ProductToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("USDCFundraiser", function () {
    let mockUSDC: MockUSDC;
    let fundraiser: USDCFundraiser;
    let owner: SignerWithAddress;
    let beneficiary: SignerWithAddress;
    let feeWallet: SignerWithAddress;
    let investor1: SignerWithAddress;
    let investor2: SignerWithAddress;
    let productToken: ProductToken;

    const minimumTarget = 1000_000000n; // 1000 USDC (with 6 decimals)
    let deadline: number;
    const enforceConditions = true;

    const INITIAL_PRODUCT_IDS = [1, 2];
    const INITIAL_PRODUCT_PRICES = [100_000000n, 200_000000n]; // 100 USDC, 200 USDC

    beforeEach(async function () {
        // Get signers
        [owner, beneficiary, feeWallet, investor1, investor2] = await ethers.getSigners();

        // Deploy mock USDC
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        mockUSDC = await MockUSDC.deploy();

        // Set deadline to 1 day from now
        deadline = (await time.latest()) + 24 * 60 * 60;

        // Deploy ProductToken first
        const ProductToken = await ethers.getContractFactory("ProductToken");
        productToken = await ProductToken.deploy("https://api.example.com/token/");
        
        // Deploy fundraiser with initial products
        const USDCFundraiser = await ethers.getContractFactory("USDCFundraiser");
        fundraiser = await USDCFundraiser.deploy(
            await mockUSDC.getAddress(),
            beneficiary.address,
            feeWallet.address,
            minimumTarget,
            deadline,
            enforceConditions,
            await productToken.getAddress(),
            INITIAL_PRODUCT_IDS,
            INITIAL_PRODUCT_PRICES
        );

        // Grant MINTER_ROLE to fundraiser
        await productToken.grantRole(await productToken.MINTER_ROLE(), await fundraiser.getAddress());

        // Transfer some USDC to investors
        await mockUSDC.transfer(investor1.address, 10000_000000n);
        await mockUSDC.transfer(investor2.address, 10000_000000n);
    });

    describe("Deployment", function () {
        it("Should set initial product prices correctly", async function () {
            for (let i = 0; i < INITIAL_PRODUCT_IDS.length; i++) {
                expect(await fundraiser.productPrices(INITIAL_PRODUCT_IDS[i]))
                    .to.equal(INITIAL_PRODUCT_PRICES[i]);
            }
        });

        it("Should reject deployment with mismatched arrays", async function () {
            const USDCFundraiser = await ethers.getContractFactory("USDCFundraiser");
            await expect(USDCFundraiser.deploy(
                await mockUSDC.getAddress(),
                beneficiary.address,
                feeWallet.address,
                minimumTarget,
                deadline,
                enforceConditions,
                await productToken.getAddress(),
                [1], // One ID
                [100_000000n, 200_000000n] // Two prices
            )).to.be.revertedWith("Arrays length mismatch");
        });

        it("Should reject deployment with empty products", async function () {
            const USDCFundraiser = await ethers.getContractFactory("USDCFundraiser");
            await expect(USDCFundraiser.deploy(
                await mockUSDC.getAddress(),
                beneficiary.address,
                feeWallet.address,
                minimumTarget,
                deadline,
                enforceConditions,
                await productToken.getAddress(),
                [], // Empty arrays
                []
            )).to.be.revertedWith("No products provided");
        });
    });

    describe("Deposits", function () {
        it("Should accept deposits and transfer fees correctly", async function () {
            const depositAmount = 1000_000000n;
            const expectedFee = (depositAmount * 250n) / 10000n; // 2.5% fee
            const expectedNet = depositAmount - expectedFee;

            await mockUSDC.connect(investor1).approve(await fundraiser.getAddress(), depositAmount);
            await fundraiser.connect(investor1).deposit(INITIAL_PRODUCT_IDS[0], 10); // Use first product ID

            expect(await fundraiser.tokenDeposits(INITIAL_PRODUCT_IDS[0])).to.equal(expectedNet);
            expect(await mockUSDC.balanceOf(feeWallet.address)).to.equal(expectedFee);
        });
    });

    describe("Finalization", function () {
        beforeEach(async function () {
            // Setup: Deposit more than minimum target
            const depositAmount = 2000_000000n; // 2000 USDC
            await mockUSDC.connect(investor1).approve(await fundraiser.getAddress(), depositAmount);
            await fundraiser.connect(investor1).deposit(1,20);
        });

        it("Should release funds when conditions are met", async function () {
            // Fast forward past deadline
            await time.increaseTo(deadline + 1);

            // Finalize
            await expect(fundraiser.finalize())
                .to.emit(fundraiser, "FundsReleased");

            // Check beneficiary received funds
            const expectedNet = 1950_000000n; // 2000 USDC - 2.5% fee
            expect(await mockUSDC.balanceOf(beneficiary.address)).to.equal(expectedNet);
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to pause and unpause", async function () {
            await fundraiser.pause();
            expect(await fundraiser.paused()).to.be.true;

            await fundraiser.unpause();
            expect(await fundraiser.paused()).to.be.false;
        });

        it("Should allow owner to update fee percentage", async function () {
            const newFee = 300; // 3%
            await expect(fundraiser.updateFeePercentage(newFee))
                .to.emit(fundraiser, "FeeUpdated")
                .withArgs(newFee);

            expect(await fundraiser.feePercentage()).to.equal(newFee);
        });
    });

    describe("NFT Integration", function () {
        it("Should mint NFT on deposit", async function () {
            const depositAmount = 1000_000000n;
            await mockUSDC.connect(investor1).approve(await fundraiser.getAddress(), depositAmount);
            
            await expect(fundraiser.connect(investor1).deposit(INITIAL_PRODUCT_IDS[0], 10))
                .to.emit(productToken, "ProductMinted")
                .withArgs(investor1.address, INITIAL_PRODUCT_IDS[0], 10);
        });

        it("Should track deposit amount against token ID", async function () {
            const depositAmount = 1000_000000n;
            const expectedNet = depositAmount - (depositAmount * 250n) / 10000n; // minus 2.5% fee
            
            await mockUSDC.connect(investor1).approve(await fundraiser.getAddress(), depositAmount);
            await fundraiser.connect(investor1).deposit(INITIAL_PRODUCT_IDS[0], 10);
            
            expect(await fundraiser.tokenDeposits(INITIAL_PRODUCT_IDS[0])).to.equal(expectedNet);
        });
    });

    describe("Deadline Management", function () {
        it("Should allow owner to update deadline", async function () {
            const newDeadline = deadline + (60 * 60); // Add 1 hour
            await fundraiser.updateDeadline(newDeadline);
            expect(await fundraiser.deadline()).to.equal(newDeadline);
        });

        it("Should reject deadline update if finalized", async function () {
            // First finalize
            const depositAmount = 2000_000000n;
            await mockUSDC.connect(investor1).approve(await fundraiser.getAddress(), depositAmount);
            await fundraiser.connect(investor1).deposit(1,20);
            await time.increaseTo(deadline + 1);
            await fundraiser.finalize();

            // Try to update deadline
            const newDeadline = deadline + (60 * 60);
            await expect(fundraiser.updateDeadline(newDeadline))
                .to.be.revertedWith("Fundraiser is finalized");
        });
    });

    describe("Product Management", function () {
        const PRODUCT_ID = 1;
        const PRODUCT_PRICE = 100_000000n; // 100 USDC

        beforeEach(async function () {
            await fundraiser.setProductPrice(PRODUCT_ID, PRODUCT_PRICE);
        });

        it("Should allow setting product prices", async function () {
            expect(await fundraiser.productPrices(PRODUCT_ID)).to.equal(PRODUCT_PRICE);
        });

        it("Should mint correct quantity of NFTs", async function () {
            const quantity = 3n;
            const totalAmount = PRODUCT_PRICE * quantity;
            
            await mockUSDC.connect(investor1).approve(await fundraiser.getAddress(), totalAmount);
            await fundraiser.connect(investor1).deposit(PRODUCT_ID, quantity);

            expect(await productToken.balanceOf(investor1.address, PRODUCT_ID)).to.equal(quantity);
        });

        it("Should reject deposit for non-existent product", async function () {
            const invalidProductId = 999;
            await expect(fundraiser.connect(investor1).deposit(invalidProductId, 1))
                .to.be.revertedWith("Product not available");
        });

        it("Should calculate fees correctly for multiple items", async function () {
            const quantity = 2n;
            const totalAmount = PRODUCT_PRICE * quantity;
            const expectedFee = (totalAmount * 250n) / 10000n;
            const expectedNet = totalAmount - expectedFee;

            await mockUSDC.connect(investor1).approve(await fundraiser.getAddress(), totalAmount);
            await fundraiser.connect(investor1).deposit(PRODUCT_ID, quantity);

            expect(await mockUSDC.balanceOf(feeWallet.address)).to.equal(expectedFee);
            expect(await fundraiser.tokenDeposits(PRODUCT_ID)).to.equal(expectedNet);
        });
    });

    describe("Refunds", function () {
        it("Should allow refund claim and burn NFTs", async function () {
            // Setup: Make a deposit first
            const productId = INITIAL_PRODUCT_IDS[0];
            const quantity = 3n;
            const totalAmount = INITIAL_PRODUCT_PRICES[0] * quantity;
            
            await mockUSDC.connect(investor1).approve(await fundraiser.getAddress(), totalAmount);
            await fundraiser.connect(investor1).deposit(productId, quantity);
            
            // Record balances before refund
            const balanceBefore = await mockUSDC.balanceOf(investor1.address);
            const nftBalanceBefore = await productToken.balanceOf(investor1.address, productId);
            
            // Finalize (ensure minimum target not met)
            await time.increaseTo(deadline + 1);
            await fundraiser.finalize();
            
            // Claim refund
            await fundraiser.connect(investor1).claimRefund(productId);
            
            // Check NFTs were burned
            expect(await productToken.balanceOf(investor1.address, productId)).to.equal(0);
            
            // Check refund was received
            const expectedRefund = totalAmount - (totalAmount * 250n) / 10000n; // minus 2.5% fee
            expect(await mockUSDC.balanceOf(investor1.address)).to.equal(balanceBefore + expectedRefund);
        });

        it("Should reject refund claim if not finalized", async function () {
            const productId = INITIAL_PRODUCT_IDS[0];
            await expect(fundraiser.connect(investor1).claimRefund(productId))
                .to.be.revertedWith("Not finalized");
        });

        it("Should reject refund claim if target was met", async function () {
            // Meet the minimum target
            const productId = INITIAL_PRODUCT_IDS[0];
            const price = INITIAL_PRODUCT_PRICES[0];
            const quantity = minimumTarget / price + 1n;
            const depositAmount = price * quantity;

            await mockUSDC.connect(investor1).approve(await fundraiser.getAddress(), depositAmount);
            await fundraiser.connect(investor1).deposit(productId, quantity);

            // Finalize
            await time.increaseTo(deadline + 1);
            await fundraiser.finalize();

            // Try to claim refund
            await expect(fundraiser.connect(investor1).claimRefund(productId))
                .to.be.revertedWith("Target was met");
        });

        it("Should reject refund claim if no tokens held", async function () {
            const productId = INITIAL_PRODUCT_IDS[0];
            
            // Finalize without any deposits
            await time.increaseTo(deadline + 1);
            await fundraiser.finalize();

            await expect(fundraiser.connect(investor1).claimRefund(productId))
                .to.be.revertedWith("No tokens to refund");
        });

        it("Should correctly handle multiple refund claims for same product", async function () {
            const productId = INITIAL_PRODUCT_IDS[0];
            const quantity1 = 3n;
            const quantity2 = 2n;
            const price = INITIAL_PRODUCT_PRICES[0];
            
            // Two investors buy same product
            await mockUSDC.connect(investor1).approve(await fundraiser.getAddress(), price * quantity1);
            await mockUSDC.connect(investor2).approve(await fundraiser.getAddress(), price * quantity2);
            
            await fundraiser.connect(investor1).deposit(productId, quantity1);
            await fundraiser.connect(investor2).deposit(productId, quantity2);

            // Finalize
            await time.increaseTo(deadline + 1);
            await fundraiser.finalize();

            // Both claim refunds
            await fundraiser.connect(investor1).claimRefund(productId);
            await fundraiser.connect(investor2).claimRefund(productId);

            // Verify both NFTs burned
            expect(await productToken.balanceOf(investor1.address, productId)).to.equal(0);
            expect(await productToken.balanceOf(investor2.address, productId)).to.equal(0);
        });
    });

    describe("Chainlink Automation", function () {
        it("Should report upkeep needed after deadline", async function () {
            await time.increaseTo(deadline + 1);
            const { upkeepNeeded } = await fundraiser.checkUpkeep("0x");
            expect(upkeepNeeded).to.be.true;
        });

        it("Should not report upkeep needed before deadline", async function () {
            const { upkeepNeeded } = await fundraiser.checkUpkeep("0x");
            expect(upkeepNeeded).to.be.false;
        });

        it("Should not report upkeep needed if already finalized", async function () {
            await time.increaseTo(deadline + 1);
            await fundraiser.finalize();
            const { upkeepNeeded } = await fundraiser.checkUpkeep("0x");
            expect(upkeepNeeded).to.be.false;
        });

        it("Should execute finalization through performUpkeep", async function () {
            // Make a deposit
            const productId = INITIAL_PRODUCT_IDS[0];
            const quantity = 1n;
            const depositAmount = INITIAL_PRODUCT_PRICES[0] * quantity;
            
            await mockUSDC.connect(investor1).approve(await fundraiser.getAddress(), depositAmount);
            await fundraiser.connect(investor1).deposit(productId, quantity);

            // Move past deadline
            await time.increaseTo(deadline + 1);

            // Perform upkeep
            await fundraiser.performUpkeep("0x");
            expect(await fundraiser.finalized()).to.be.true;
        });
    });
}); 