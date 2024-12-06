const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FundraisingCampaign", function () {
  let Campaign, campaign, Token, token, MockUSDC, usdc, owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy mock USDC first
    MockUSDC = await ethers.getContractFactory("MockUSDC");  // You'll need to create this
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    // Deploy Campaign contract
    Campaign = await ethers.getContractFactory("FundraisingCampaign");
    campaign = await Campaign.deploy(
      ethers.parseUnits("100", 6), // targetAmount in USDC (6 decimals)
      1000n, // totalTokens (using BigInt)
      "TestToken",
      "TTK",
      await usdc.getAddress()
    );
    await campaign.waitForDeployment();

    // Get the token address from the campaign
    const tokenAddress = await campaign.governanceToken();
    token = await ethers.getContractAt("ProjectToken", tokenAddress);
    
    // Mint some USDC to addr1 for testing
    await usdc.mint(addr1.address, ethers.parseUnits("1000", 6));
    // Approve campaign to spend addr1's USDC
    await usdc.connect(addr1).approve(await campaign.getAddress(), ethers.parseUnits("1000", 6));
    
    // Add this: Transfer some USDC to the campaign contract
    await usdc.transfer(await campaign.getAddress(), ethers.parseUnits("10", 6));
  });

  it("Should allow investment and mint tokens", async function () {
    await campaign.connect(addr1).invest(ethers.parseUnits("1", 6)); // 1 USDC
    expect(await token.balanceOf(addr1.address)).to.be.gt(0);
  });

  it("Should create a proposal", async function () {
    // First invest to get governance tokens
    await campaign.connect(addr1).invest(ethers.parseUnits("1", 6)); // 1 USDC

    // Now create the proposal
    const recipient = addr2.address;
    const amount = ethers.parseUnits("0.5", 6); // 0.5 USDC
    await campaign.connect(addr1).createProposal(recipient, amount);
    
    const proposal = await campaign.proposals(1);
    expect(proposal.recipient).to.equal(recipient);
    expect(proposal.amount).to.equal(amount);
  });

  it("Should allow voting and execute a proposal", async function () {
    // First invest to get governance tokens
    await campaign.connect(addr1).invest(ethers.parseUnits("1", 6)); // 1 USDC

    // Create proposal and vote
    await campaign.connect(addr1).createProposal(addr2.address, ethers.parseUnits("0.5", 6));
    await campaign.connect(addr1).vote(1, true);
    
    const proposal = await campaign.proposals(1);
    expect(proposal.executed).to.be.true;
    expect(await usdc.balanceOf(addr2.address)).to.equal(ethers.parseUnits("0.5", 6));
  });
});