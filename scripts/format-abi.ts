import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
    const USDCFundraiser = await ethers.getContractFactory("USDCFundraiser");
    const abi = JSON.parse(USDCFundraiser.interface.formatJson());
    
    // Filter and transform to Chainlink's format
    const chainlinkAbi = abi
        .filter((item: any) => item.type === "function")
        .map((item: any) => ({
            name: item.name,
            inputs: item.inputs?.map((input: any) => ({
                name: input.name,
                type: input.type
            })) || []
        }));
    
    fs.writeFileSync(
        'chainlink-abi.json',
        JSON.stringify(chainlinkAbi, null, 2)
    );
    console.log("Chainlink-formatted ABI saved to abi/chainlink-abi.json");
}

main().catch(console.error); 