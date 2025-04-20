import { ethers } from "hardhat";
import { USDCFundraiserFactory, USDCFundraiser } from "../typechain-types";
import { IERC20 } from "../typechain-types/@openzeppelin/contracts/token/ERC20";

async function main() {
    // Contract addresses (replace with your deployed addresses)
    const FACTORY_ADDRESS = "0x5861e431B6552BC79d9dF1465D9Ba4838C06f5C9";
    const FUJI_USDC = "0x5425890298aed601595a70AB815c96711a31Bc65";

    console.log("Testing special fee functionality on Fuji...");

    // Get contract instances
    const factory = await ethers.getContractAt("USDCFundraiserFactory", FACTORY_ADDRESS) as USDCFundraiserFactory;
    const usdc = await ethers.getContractAt("IERC20", FUJI_USDC) as IERC20;

    // Get signers
    const [owner] = await ethers.getSigners();
    console.log("Factory Owner:", owner.address);
    //console.log("Creator Address:", creator.address);

    // Set special fee for creator (5%)
    const specialFee = 500; // 5%
    console.log("\nSetting special fee of 5% for creator...");
    const setFeeTx = await factory.setSpecialFee(owner.address, specialFee);
    await setFeeTx.wait();
    
    // Verify special fee was set
    const setFee = await factory.getSpecialFee(owner.address);
    console.log("Special fee set:", setFee.toString(), "basis points");

    // Setup fundraiser parameters
    const beneficiaryWallet = owner.address;
    const fundingType = 0; // All or nothing
    const minimumTarget = ethers.parseUnits("1000", 6); // 1000 USDC
    const deadline = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

    // Create product config
    const products = [{
        productId: 1n,
        price: ethers.parseUnits("100", 6), // 100 USDC
        supplyLimit: 10n
    }];

    console.log("\nCreating fundraiser with special fee...");
    // Create fundraiser as creator
    const createFundraiserTx = await factory.connect(owner).createFundraiser(
        beneficiaryWallet,
        fundingType,
        minimumTarget,
        deadline,
        products
    );
    
    const receipt = await createFundraiserTx.wait();
    
    // Get the created fundraiser address from event
    let fundraiserAddress = "";
    receipt!.logs.forEach(log => {
        //console.log(factory.interface.parseLog(log));
        if (factory.interface.parseLog(log)?.name == "FundraiserCreated") {
            fundraiserAddress = factory.interface.parseLog(log)?.args[0];
            console.log("Fundraiser deployed to:", fundraiserAddress);
        }
    })
    
    console.log("New fundraiser deployed at:", fundraiserAddress);

    // Get the fundraiser contract
    const fundraiser = await ethers.getContractAt("USDCFundraiser", fundraiserAddress) as USDCFundraiser;

    // Verify the fee percentage in the created fundraiser
    const feePercentage = await fundraiser.feePercentage();
    console.log("\nFundraiser fee percentage:", feePercentage.toString(), "basis points");

    // Verify the special fee was cleared after use
    const remainingSpecialFee = await factory.getSpecialFee(owner.address);
    console.log("Remaining special fee for creator:", remainingSpecialFee.toString(), "basis points");

    // Create another fundraiser with same creator - should use default fee
    console.log("\nCreating second fundraiser (should use default fee)...");
    const createFundraiserTx2 = await factory.connect(owner).createFundraiser(
        beneficiaryWallet,
        fundingType,
        minimumTarget,
        deadline,
        products
    );

    const receipt2 = await createFundraiserTx2.wait();
    
    let fundraiserAddress2 = "";
    receipt2!.logs.forEach(log => {
        //console.log(factory.interface.parseLog(log));
        if (factory.interface.parseLog(log)?.name == "FundraiserCreated") {
            fundraiserAddress2 = factory.interface.parseLog(log)?.args[0];
            console.log("Second fundraiser deployed to:", fundraiserAddress2);
        }
    })

    const fundraiser2 = await ethers.getContractAt("USDCFundraiser", fundraiserAddress2) as USDCFundraiser;

    // Verify second fundraiser has default fee
    const defaultFeePercentage = await fundraiser2.feePercentage();
    console.log("Second fundraiser fee percentage:", defaultFeePercentage.toString(), "basis points");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
