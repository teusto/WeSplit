"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useLogin, usePrivy, useSendTransaction } from "@privy-io/react-auth";
import { encodeFunctionData, formatEther } from "viem";

import {
  BILL_SPLIT_ABI,
  BILL_SPLIT_ADDRESS,
  billPublicClient,
} from "../../lib/billContract";
import { usePrivyWalletOwner } from "../../components/privy-provider";

type BillView = {
  owner: `0x${string}`;
  totalAmount: bigint;
  deadline: bigint;
  currency: string;
  settled: boolean;
  payerCount: number;
  paidCount: number;
  collectedAmount: bigint;
};

export default function BillJoinPage() {
  const params = useParams<{ billId: string }>();
  const searchParams = useSearchParams();
  const { ready, user } = usePrivy();
  const { login } = useLogin();
  const { sendTransaction } = useSendTransaction();
  const walletAddress = usePrivyWalletOwner();

  const [bill, setBill] = useState<BillView | null>(null);
  const [shares, setShares] = useState<bigint[]>([]);
  const [paid, setPaid] = useState<boolean[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [joinTxHash, setJoinTxHash] = useState<string>("");
  const [settleTxHash, setSettleTxHash] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const billId = useMemo(() => {
    try {
      return BigInt(params.billId);
    } catch {
      return null;
    }
  }, [params.billId]);

  const contractAddress =
    searchParams.get("contract") || BILL_SPLIT_ADDRESS || "";

  const loadBill = useCallback(async () => {
    if (!contractAddress || billId === null) {
      return;
    }

    try {
      const summary = (await billPublicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: BILL_SPLIT_ABI,
        functionName: "getBill",
        args: [billId],
      })) as [
        `0x${string}`,
        bigint,
        bigint,
        string,
        boolean,
        number,
        number,
        bigint,
      ];

      const slotData = (await billPublicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: BILL_SPLIT_ABI,
        functionName: "getBillSlots",
        args: [billId],
      })) as [bigint[], boolean[]];

      setBill({
        owner: summary[0],
        totalAmount: summary[1],
        deadline: summary[2],
        currency: summary[3],
        settled: summary[4],
        payerCount: Number(summary[5]),
        paidCount: Number(summary[6]),
        collectedAmount: summary[7],
      });
      setShares(slotData[0]);
      setPaid(slotData[1]);

      const firstUnpaid = slotData[1].findIndex((v) => !v);
      if (firstUnpaid >= 0) {
        setSelectedSlot(firstUnpaid);
      }
    } catch (err) {
      console.error(err);
      setError("Could not load this bill.");
    }
  }, [billId, contractAddress]);

  useEffect(() => {
    loadBill();
  }, [loadBill]);

  const handleJoin = async () => {
    if (!bill || billId === null || !contractAddress) return;
    if (paid[selectedSlot]) {
      setError("This slot is already paid.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      setJoinTxHash("");

      const value = shares[selectedSlot];
      const data = encodeFunctionData({
        abi: BILL_SPLIT_ABI,
        functionName: "joinBill",
        args: [billId, selectedSlot],
      });

      const tx = await sendTransaction({
        to: contractAddress as `0x${string}`,
        data,
        value,
      });

      setJoinTxHash(tx.hash);
      await billPublicClient.waitForTransactionReceipt({ hash: tx.hash });
      await loadBill();
    } catch (err) {
      console.error(err);
      setError("Failed to join this bill.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSettle = async () => {
    if (!bill || billId === null || !contractAddress) return;

    try {
      setIsSubmitting(true);
      setError("");
      setSettleTxHash("");

      const data = encodeFunctionData({
        abi: BILL_SPLIT_ABI,
        functionName: "settle",
        args: [billId],
      });

      const tx = await sendTransaction({
        to: contractAddress as `0x${string}`,
        data,
        value: 0,
      });

      setSettleTxHash(tx.hash);
      await billPublicClient.waitForTransactionReceipt({ hash: tx.hash });
      await loadBill();
    } catch (err) {
      console.error(err);
      setError("Failed to settle bill.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!ready) {
    return <div className="p-6">Loading wallet...</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
        <p className="mb-4 text-slate-700">Connect wallet to join this bill</p>
        <button
          type="button"
          onClick={() => login()}
          className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white"
        >
          Login / Connect Wallet
        </button>
      </div>
    );
  }

  if (!bill) {
    return <div className="p-6 text-slate-700">Loading bill...</div>;
  }

  const deadlineDate = new Date(Number(bill.deadline) * 1000);
  const canOwnerSettle =
    walletAddress?.toLowerCase() === bill.owner.toLowerCase() &&
    !bill.settled &&
    (bill.paidCount === bill.payerCount || Date.now() >= deadlineDate.getTime());

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Bill #{params.billId}</h1>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p>Total: {formatEther(bill.totalAmount)} MON</p>
        <p>Currency: {bill.currency}</p>
        <p>Owner: {bill.owner}</p>
        <p>Deadline: {deadlineDate.toLocaleString()}</p>
        <p>
          Status: {bill.paidCount}/{bill.payerCount} paid {bill.settled ? "(settled)" : ""}
        </p>
      </div>

      {!bill.settled ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <label className="block text-sm text-slate-600">Choose your payer slot</label>
          <select
            value={selectedSlot}
            onChange={(e) => setSelectedSlot(Number(e.target.value))}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          >
            {shares.map((share, index) => (
              <option key={index} value={index} disabled={paid[index]}>
                Slot {index + 1} - {formatEther(share)} MON {paid[index] ? "(paid)" : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleJoin}
            disabled={isSubmitting || paid[selectedSlot]}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-60"
          >
            {isSubmitting ? "Submitting..." : `Pay ${formatEther(shares[selectedSlot] || BigInt(0))} MON`}
          </button>
        </div>
      ) : null}

      {canOwnerSettle ? (
        <button
          type="button"
          onClick={handleSettle}
          disabled={isSubmitting}
          className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
        >
          Collect (settle)
        </button>
      ) : null}

      {joinTxHash ? (
        <a
          href={`https://testnet.monadscan.com/tx/${joinTxHash}`}
          target="_blank"
          rel="noreferrer"
          className="block text-sm text-blue-600 underline"
        >
          Join tx: {joinTxHash}
        </a>
      ) : null}

      {settleTxHash ? (
        <a
          href={`https://testnet.monadscan.com/tx/${settleTxHash}`}
          target="_blank"
          rel="noreferrer"
          className="block text-sm text-blue-600 underline"
        >
          Settle tx: {settleTxHash}
        </a>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
