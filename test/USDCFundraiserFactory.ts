import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MockUSDC, USDCFundraiserFactory, ProductToken, MockLINK, MockAutomationRegistrar } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("USDCFundraiserFactory", function () {
    let mockUSDC: MockUSDC;
    let factory: USDCFundraiserFactory;
    let productToken: ProductToken;
    let mockLink: MockLINK;
    let mockRegistrar: MockAutomationRegistrar;
    let owner: SignerWithAddress;
    let beneficiary: SignerWithAddress;
    let feeWallet: SignerWithAddress;
    let creator: SignerWithAddress;

    const minimumTarget = 1000_000000n; // 1000 USDC
    let deadline: number;
    const INITIAL_PRODUCT_IDS = [1, 2];
    const INITIAL_PRODUCT_PRICES = [100_000000n, 200_000000n];

    beforeEach(async function () {
        [owner, beneficiary, feeWallet, creator] = await ethers.getSigners();

        // Deploy mock contracts
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        mockUSDC = await MockUSDC.deploy();

        const MockLINK = await ethers.getContractFactory("MockLINK");
        mockLink = await MockLINK.deploy();

        const MockRegistrar = await ethers.getContractFactory("MockAutomationRegistrar");
        mockRegistrar = await MockRegistrar.deploy();

        // Deploy ProductToken
        const ProductToken = await ethers.getContractFactory("ProductToken");
        productToken = await ProductToken.deploy("https://api.example.com/token/", "Test Collection", "TEST");

        // Deploy Factory
        const Factory = await ethers.getContractFactory("USDCFundraiserFactory");
        factory = await Factory.deploy(
            await mockUSDC.getAddress(),
            await productToken.getAddress(),
            await mockLink.getAddress(),
            await mockRegistrar.getAddress(),
            await mockRegistrar.getAddress(), // Using mockRegistrar as registry for testing
            "0x3f678e11"
        );

        deadline = (await time.latest()) + 24 * 60 * 60;
    });

    describe("Fundraiser Creation", function () {
        it("Should create a new fundraiser", async function () {
            const tx = await factory.connect(creator).createFundraiser(
                beneficiary.address,
                feeWallet.address,
                0, // funding type: all or nothing
                minimumTarget,
                deadline,
                true,
                INITIAL_PRODUCT_IDS,
                INITIAL_PRODUCT_PRICES
            );

            const receipt = await tx.wait();
            const event = receipt?.logs.find(
                log => factory.interface.parseLog(log)?.name === "FundraiserCreated"
            );
            expect(event).to.not.be.undefined;

            const parsedEvent = factory.interface.parseLog(event!);
            const fundraiserAddress = parsedEvent?.args[0];
            expect(fundraiserAddress).to.not.equal(ethers.ZeroAddress);
        });

        it("Should set correct owner for created fundraiser", async function () {
            const tx = await factory.connect(creator).createFundraiser(
                beneficiary.address,
                feeWallet.address,
                0,
                minimumTarget,
                deadline,
                true,
                INITIAL_PRODUCT_IDS,
                INITIAL_PRODUCT_PRICES
            );

            const receipt = await tx.wait();
            const event = factory.interface.parseLog(receipt!.logs[0]);
            const fundraiserAddress = event?.args[0];

            const fundraiser = await ethers.getContractAt("USDCFundraiser", fundraiserAddress);
            expect(await fundraiser.owner()).to.equal(await factory.owner());
        });
    });
}); 