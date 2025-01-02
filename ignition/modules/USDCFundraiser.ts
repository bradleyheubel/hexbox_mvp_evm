import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const USDCFundraiserModule = buildModule("USDCFundraiserModule", (m) => {
    const usdcAddress = m.getParameter("usdcAddress");
    const beneficiaryWallet = m.getParameter("beneficiaryWallet");
    const feeWallet = m.getParameter("feeWallet");
    const minimumTarget = m.getParameter("minimumTarget");
    const deadline = m.getParameter("deadline");
    const enforceConditions = m.getParameter("enforceConditions");

    const fundraiser = m.contract("USDCFundraiser", [
        usdcAddress,
        beneficiaryWallet,
        feeWallet,
        minimumTarget,
        deadline,
        enforceConditions
    ]);

    return { fundraiser };
});

export default USDCFundraiserModule; 