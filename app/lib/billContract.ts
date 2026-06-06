import { createPublicClient, decodeEventLog, http, parseEther } from "viem";
import type { Abi } from "viem";
import { monadTestnet } from "viem/chains";

export const BILL_SPLIT_ABI = [
  {
    type: "event",
    name: "BillCreated",
    inputs: [
      { name: "billId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "totalAmount", type: "uint256", indexed: false },
      { name: "deadline", type: "uint64", indexed: false },
      { name: "currency", type: "string", indexed: false },
      { name: "payerCount", type: "uint16", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "createBill",
    inputs: [
      { name: "totalAmount", type: "uint256" },
      { name: "sharesBps", type: "uint16[]" },
      { name: "deadline", type: "uint64" },
      { name: "currency", type: "string" },
    ],
    outputs: [{ name: "billId", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "payable",
    name: "joinBill",
    inputs: [
      { name: "billId", type: "uint256" },
      { name: "slot", type: "uint16" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "settle",
    inputs: [{ name: "billId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getBill",
    inputs: [{ name: "billId", type: "uint256" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "totalAmount", type: "uint256" },
      { name: "deadline", type: "uint64" },
      { name: "currency", type: "string" },
      { name: "settled", type: "bool" },
      { name: "payerCount", type: "uint16" },
      { name: "paidCount", type: "uint16" },
      { name: "collectedAmount", type: "uint256" },
    ],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getBillSlots",
    inputs: [{ name: "billId", type: "uint256" }],
    outputs: [
      { name: "sharesWei", type: "uint256[]" },
      { name: "paid", type: "bool[]" },
    ],
  },
] as const satisfies Abi;

export const BILL_SPLIT_ADDRESS =
  process.env.NEXT_PUBLIC_BILL_SPLIT_ADDRESS || "";

export const billPublicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

export const toWeiFromMon = (amount: string) => parseEther(amount || "0");

export const parseBillCreatedIdFromReceipt = (
  logs: { topics: string[]; data: `0x${string}` }[],
): bigint | null => {
  for (const log of logs) {
    if (!log.topics.length) {
      continue;
    }

    const topics = log.topics as [`0x${string}`, ...`0x${string}`[]];

    try {
      const decoded = decodeEventLog({
        abi: BILL_SPLIT_ABI,
        data: log.data,
        topics,
      });

      if (decoded.eventName === "BillCreated") {
        return decoded.args.billId as bigint;
      }
    } catch {
      // ignore unrelated logs
    }
  }

  return null;
};
