import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MockUSDC, USDCFundraiser } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("USDCFundraiser", function () {
    let mockUSDC: MockUSDC;
    let fundraiser: USDCFundraiser;
    let owner: SignerWithAddress;
    let beneficiary: SignerWithAddress;
    let feeWallet: SignerWithAddress;
    let investor1: SignerWithAddress;
    let investor2: SignerWithAddress;

    const minimumTarget = 1000_000000n; // 1000 USDC (with 6 decimals)
    let deadline: number;
    const enforceConditions = true;

    beforeEach(async function () {
        // Get signers
        [owner, beneficiary, feeWallet, investor1, investor2] = await ethers.getSigners();

        // Deploy mock USDC
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        mockUSDC = await MockUSDC.deploy();

        // Set deadline to 1 day from now
        deadline = (await time.latest()) + 24 * 60 * 60;

        // Deploy fundraiser
        const USDCFundraiser = await ethers.getContractFactory("USDCFundraiser");
        fundraiser = await USDCFundraiser.deploy(
            await mockUSDC.getAddress(),
            beneficiary.address,
            feeWallet.address,
            minimumTarget,
            deadline,
            enforceConditions
        );

        // Transfer some USDC to investors
        await mockUSDC.transfer(investor1.address, 10000_000000n); // 10,000 USDC
        await mockUSDC.transfer(investor2.address, 10000_000000n); // 10,000 USDC
    });

    describe("Deposits", function () {
        it("Should accept deposits and transfer fees correctly", async function () {
            const depositAmount = 1000_000000n; // 1000 USDC
            const expectedFee = (depositAmount * 250n) / 10000n; // 2.5% fee
            const expectedNet = depositAmount - expectedFee;

            // Approve and deposit
            await mockUSDC.connect(investor1).approve(await fundraiser.getAddress(), depositAmount);
            await expect(fundraiser.connect(investor1).deposit(depositAmount))
                .to.emit(fundraiser, "Deposit")
                .withArgs(investor1.address, depositAmount, expectedFee);

            // Check balances
            expect(await fundraiser.deposits(investor1.address)).to.equal(expectedNet);
            expect(await fundraiser.totalRaised()).to.equal(expectedNet);
            expect(await mockUSDC.balanceOf(feeWallet.address)).to.equal(expectedFee);
        });
    });

    describe("Finalization", function () {
        beforeEach(async function () {
            // Setup: Deposit more than minimum target
            const depositAmount = 2000_000000n; // 2000 USDC
            await mockUSDC.connect(investor1).approve(await fundraiser.getAddress(), depositAmount);
            await fundraiser.connect(investor1).deposit(depositAmount);
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
}); 