"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSendTransaction } from "@privy-io/react-auth";
import { encodeFunctionData, formatEther } from "viem";
import { QRCodeSVG } from "qrcode.react";

import type { Bill } from "./CameraVision";
import BillInfo from "./BillInfo";
import InviteButton, { type InviteItem } from "./InviteButton";
import {
  BILL_SPLIT_ABI,
  BILL_SPLIT_ADDRESS,
  billPublicClient,
  parseBillCreatedIdFromReceipt,
  toWeiFromMon,
} from "../lib/billContract";

type OnchainBillComposerProps = {
  extractedBill: Bill | null;
};

const DEADLINE_OPTIONS = [
  { label: "24h", value: 24 },
  { label: "48h", value: 48 },
] as const;

const buildEqualShares = (payerCount: number): number[] => {
  const base = Math.floor(10_000 / payerCount);
  const shares = Array.from({ length: payerCount }, () => base);
  const allocated = base * payerCount;
  shares[0] += 10_000 - allocated;
  return shares;
};

const normalizePercentages = (values: number[]): number[] | null => {
  if (!values.length || values.some((v) => v <= 0)) {
    return null;
  }

  const sum = values.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) {
    return null;
  }

  const bpsRaw = values.map((value) => Math.floor((value / sum) * 10_000));
  const total = bpsRaw.reduce((acc, value) => acc + value, 0);
  bpsRaw[0] += 10_000 - total;
  return bpsRaw;
};

export default function OnchainBillComposer({ extractedBill }: OnchainBillComposerProps) {
  const { sendTransaction } = useSendTransaction();

  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [customPercents, setCustomPercents] = useState<number[]>([40, 30, 30]);
  const [deadlineHours, setDeadlineHours] = useState<number>(24);
  const [editableTotal, setEditableTotal] = useState<string>("");
  const [editableCurrency, setEditableCurrency] = useState<string>("EUR");
  const [createTxHash, setCreateTxHash] = useState<string>("");
  const [createdBillId, setCreatedBillId] = useState<bigint | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  const contractAddress = BILL_SPLIT_ADDRESS;
  const payerCount = invites.length;

  const shareUrl = useMemo(() => {
    if (!createdBillId || !contractAddress || typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}/bill/${createdBillId.toString()}?contract=${contractAddress}&chain=testnet`;
  }, [createdBillId, contractAddress]);

  useEffect(() => {
    if (!extractedBill) {
      return;
    }

    setEditableTotal(String(extractedBill.value));
    setEditableCurrency(extractedBill.currency || "EUR");
  }, [extractedBill]);

  useEffect(() => {
    if (!payerCount) {
      setCustomPercents([]);
      return;
    }

    setCustomPercents((prev) => {
      const next = Array.from({ length: payerCount }, (_, index) => prev[index] ?? 0);
      const hasAnyNonZero = next.some((v) => v !== 0);
      if (!hasAnyNonZero) {
        const fallback = buildEqualShares(payerCount).map((bps) => Number((bps / 100).toFixed(2)));
        return fallback;
      }
      return next;
    });
  }, [payerCount]);

  if (!extractedBill) {
    return null;
  }

  const handleCreateBill = async () => {
    setError("");
    setCreateTxHash("");

    if (!contractAddress) {
      setError("Missing NEXT_PUBLIC_BILL_SPLIT_ADDRESS env var.");
      return;
    }

    const total = Number(editableTotal);
    if (!Number.isFinite(total) || total <= 0) {
      setError("Total must be a positive number.");
      return;
    }

    if (payerCount < 1) {
      setError("Add at least one payer using Invite.");
      return;
    }

    const sharesBps =
      splitMode === "equal"
        ? buildEqualShares(payerCount)
        : normalizePercentages(customPercents.slice(0, payerCount));

    if (!sharesBps || sharesBps.length !== payerCount) {
      setError("Invalid split percentages.");
      return;
    }

    const deadline = Math.floor(Date.now() / 1000) + deadlineHours * 3600;

    try {
      setIsSubmitting(true);

      const data = encodeFunctionData({
        abi: BILL_SPLIT_ABI,
        functionName: "createBill",
        args: [
          toWeiFromMon(total.toString()),
          sharesBps.map((v) => v),
          BigInt(deadline),
          editableCurrency || "EUR",
        ],
      });

      const tx = await sendTransaction({
        to: contractAddress as `0x${string}`,
        data,
        value: 0,
      });

      setCreateTxHash(tx.hash);

      const receipt = await billPublicClient.waitForTransactionReceipt({
        hash: tx.hash,
      });

      const billId = parseBillCreatedIdFromReceipt(
        receipt.logs.map((log) => ({
          topics: [...log.topics],
          data: log.data,
        })),
      );

      if (billId === null) {
        setError("Bill created, but could not read billId from tx logs.");
        return;
      }

      setCreatedBillId(billId);
      setIsSuccessModalOpen(true);
    } catch (err) {
      console.error(err);
      setError("Failed to create bill on Monad.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Create Bill Onchain</h3>

      <div className="mt-4 grid gap-4">
        <BillInfo
          total={editableTotal}
          currency={editableCurrency}
          onTotalChange={setEditableTotal}
          onCurrencyChange={setEditableCurrency}
        />

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
          <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Payers (from invites)
          </h4>
          <InviteButton onInvitesChange={setInvites} />
          <p className="mt-2 text-sm text-slate-500">Current payers: {payerCount}</p>
        </div>

        <div>
          <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">Split mode</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSplitMode("equal")}
              className={`rounded-md px-3 py-2 text-sm ${splitMode === "equal" ? "bg-slate-900 text-white" : "border border-slate-300"}`}
            >
              Equal
            </button>
            <button
              type="button"
              onClick={() => setSplitMode("custom")}
              className={`rounded-md px-3 py-2 text-sm ${splitMode === "custom" ? "bg-slate-900 text-white" : "border border-slate-300"}`}
            >
              Custom %
            </button>
          </div>
        </div>

        {splitMode === "custom" ? (
          <div className="grid gap-2">
            {Array.from({ length: payerCount }).map((_, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-28 text-sm text-slate-600 dark:text-slate-300">
                  {invites[index]?.label || `Payer ${index + 1}`}
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={customPercents[index] ?? 0}
                  onChange={(e) => {
                    const next = [...customPercents];
                    next[index] = Number(e.target.value || 0);
                    setCustomPercents(next);
                  }}
                  className="w-32 rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                />
                <span className="text-sm text-slate-500">%</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Equal split per payer ({formatEther(toWeiFromMon(editableTotal || "0") / BigInt(Math.max(payerCount, 1)))} MON each approx)
          </p>
        )}

        <div>
          <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">Deadline</p>
          <div className="flex gap-2">
            {DEADLINE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDeadlineHours(option.value)}
                className={`rounded-md px-3 py-2 text-sm ${deadlineHours === option.value ? "bg-slate-900 text-white" : "border border-slate-300"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreateBill}
          disabled={isSubmitting}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {isSubmitting ? "Submitting..." : "Create Bill on Monad"}
        </button>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {createTxHash ? (
          <a
            href={`https://testnet.monadscan.com/tx/${createTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 underline"
          >
            Create tx: {createTxHash}
          </a>
        ) : null}

        {createdBillId !== null ? (
          <div className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-sm text-slate-700 dark:text-slate-200">Bill ID: {createdBillId.toString()}</p>
            <p className="text-xs text-slate-500">Share link + QR are shown in the success modal.</p>
          </div>
        ) : null}
      </div>

      {isSuccessModalOpen && createdBillId !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Bill created on Monad</h4>
            <p className="mt-1 text-sm text-slate-500">Share this QR so payers can open and pay from their phones.</p>

            {shareUrl ? (
              <div className="mt-4 grid gap-3">
                <div className="mx-auto w-fit rounded-lg bg-white p-2">
                  <QRCodeSVG value={shareUrl} size={220} includeMargin={true} />
                </div>
                <Link href={shareUrl} className="break-all text-sm text-blue-600 underline">
                  {shareUrl}
                </Link>
              </div>
            ) : null}

            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
              <p>Contract: <span className="font-mono">{contractAddress}</span></p>
              <p>Bill ID: <span className="font-mono">{createdBillId.toString()}</span></p>
              {createTxHash ? (
                <a
                  href={`https://testnet.monadscan.com/tx/${createTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-blue-600 underline"
                >
                  Open create tx in explorer
                </a>
              ) : null}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSuccessModalOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
