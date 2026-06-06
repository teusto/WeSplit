import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("BillSplitModule", (m) => {
  const billSplit = m.contract("BillSplit");
  return { billSplit };
});