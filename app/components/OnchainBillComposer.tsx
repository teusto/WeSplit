"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSendTransaction, useWallets } from "@privy-io/react-auth";
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

const SPLIT_COLORS = [
  "#ff7830",
  "#ff9b62",
  "#ffc29b",
  "#0a0a0a",
  "#5a5a5a",
  "#f57c47",
];

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
  const { wallets } = useWallets();

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

  const activeWalletAddress = useMemo(() => {
    if (!wallets.length) {
      return null;
    }

    const ethereumWallet = wallets.find((wallet) => {
      const candidate = wallet as { chainType?: string };
      return candidate.chainType === "ethereum";
    });

    return ethereumWallet?.address ?? wallets[0]?.address ?? null;
  }, [wallets]);

  const splitPreviewPercents = useMemo(() => {
    if (!payerCount) {
      return [] as number[];
    }

    if (splitMode === "equal") {
      return buildEqualShares(payerCount).map((bps) => bps / 100);
    }

    const normalized = normalizePercentages(customPercents.slice(0, payerCount));
    if (!normalized) {
      return buildEqualShares(payerCount).map((bps) => bps / 100);
    }

    return normalized.map((bps) => bps / 100);
  }, [customPercents, payerCount, splitMode]);

  const splitGradient = useMemo(() => {
    if (!splitPreviewPercents.length) {
      return "conic-gradient(from 180deg, #ff7830 0deg 360deg)";
    }

    let cursor = 0;
    const stops = splitPreviewPercents.map((value, index) => {
      const next = cursor + (value / 100) * 360;
      const color = SPLIT_COLORS[index % SPLIT_COLORS.length];
      const stop = `${color} ${cursor}deg ${next}deg`;
      cursor = next;
      return stop;
    });

    return `conic-gradient(from 180deg, ${stops.join(", ")})`;
  }, [splitPreviewPercents]);

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

    if (!activeWalletAddress) {
      setError("No connected wallet found. Reconnect wallet and try again.");
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

      const tx = await sendTransaction(
        {
          to: contractAddress as `0x${string}`,
          data,
          value: 0,
        },
        {
          address: activeWalletAddress,
        },
      );

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

      let resolvedBillId = billId;

      if (resolvedBillId === null) {
        try {
          const nextBillId = await billPublicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: [
              {
                type: "function",
                stateMutability: "view",
                name: "nextBillId",
                inputs: [],
                outputs: [{ type: "uint256" }],
              },
            ] as const,
            functionName: "nextBillId",
          });

          if (nextBillId > BigInt(0)) {
            const candidateBillId = nextBillId - BigInt(1);
            const billData = await billPublicClient.readContract({
              address: contractAddress as `0x${string}`,
              abi: BILL_SPLIT_ABI,
              functionName: "getBill",
              args: [candidateBillId],
            });

            const candidateOwner = billData[0] as string;
            if (candidateOwner.toLowerCase() === activeWalletAddress.toLowerCase()) {
              resolvedBillId = candidateBillId;
            }
          }
        } catch (fallbackError) {
          console.error("Fallback billId resolution failed", fallbackError);
        }
      }

      if (resolvedBillId === null) {
        setError("Bill created, but could not read billId from tx logs.");
        return;
      }

      setCreatedBillId(resolvedBillId);
      setIsSuccessModalOpen(true);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("No embedded or connected wallet found for address")) {
        setError("Wallet not available in Privy session. Please reconnect and try again.");
      } else {
        setError("Failed to create bill on Monad.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[var(--foreground)]/15 bg-white/45 p-5 text-center">
      <h3 className="text-2xl text-[var(--foreground)]">Create bill onchain</h3>

      <div className="mt-4 grid gap-4">
        <BillInfo
          total={editableTotal}
          currency={editableCurrency}
          onTotalChange={setEditableTotal}
          onCurrencyChange={setEditableCurrency}
        />

        <div className="rounded-xl border border-[var(--foreground)]/15 bg-white/50 p-4 text-left">
          <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--foreground)]/70">
            Payers (from invites)
          </h4>
          <InviteButton onInvitesChange={setInvites} />
          <p className="mt-2 text-sm text-[var(--foreground)]/65">Current payers: {payerCount}</p>
        </div>

        <div className="rounded-xl border border-[var(--foreground)]/15 bg-white/50 p-4 text-left">
          <p className="mb-2 text-sm text-[var(--foreground)]/70">Split mode</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSplitMode("equal")}
              className={`rounded-full px-4 py-2 text-sm transition ${splitMode === "equal" ? "bg-[var(--highlight)] text-white" : "border border-[var(--foreground)]/30 text-[var(--foreground)]/80"}`}
            >
              Equal
            </button>
            <button
              type="button"
              onClick={() => setSplitMode("custom")}
              className={`rounded-full px-4 py-2 text-sm transition ${splitMode === "custom" ? "bg-[var(--highlight)] text-white" : "border border-[var(--foreground)]/30 text-[var(--foreground)]/80"}`}
            >
              Custom %
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--foreground)]/15 bg-white/55 p-4">
          <p className="mb-3 text-sm text-[var(--foreground)]/70">Live split visualization</p>
          <div className="mx-auto flex w-fit items-center gap-4">
            <div className="split-blob-pulse rounded-full p-2" style={{ background: "radial-gradient(circle at 20% 20%, #ffffffcc, #ffffff66)" }}>
              <div
                className="relative h-24 w-24 rounded-full"
                style={{ background: splitGradient }}
              >
                <div className="absolute inset-4 grid place-items-center rounded-full bg-[#f9e2cf] text-xs text-[var(--foreground)]/70">
                  {payerCount || 0} payer{payerCount === 1 ? "" : "s"}
                </div>
              </div>
            </div>

            <div className="grid gap-1 text-left text-xs text-[var(--foreground)]/65">
              {splitPreviewPercents.slice(0, 4).map((value, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: SPLIT_COLORS[index % SPLIT_COLORS.length] }}
                  />
                  <span>{invites[index]?.label || `Payer ${index + 1}`}</span>
                  <span className="font-medium">{value.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {splitMode === "custom" ? (
          <div className="grid gap-2 rounded-xl border border-[var(--foreground)]/15 bg-white/50 p-4">
            {Array.from({ length: payerCount }).map((_, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-28 text-sm text-[var(--foreground)]/75">
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
                  className="w-32 rounded-md border border-[var(--foreground)]/25 bg-white/70 px-3 py-2"
                />
                <span className="text-sm text-[var(--foreground)]/60">%</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--foreground)]/65">
            Equal split per payer ({formatEther(toWeiFromMon(editableTotal || "0") / BigInt(Math.max(payerCount, 1)))} MON each approx)
          </p>
        )}

        <div className="rounded-xl border border-[var(--foreground)]/15 bg-white/50 p-4 text-left">
          <p className="mb-2 text-sm text-[var(--foreground)]/70">Deadline</p>
          <div className="flex gap-2">
            {DEADLINE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDeadlineHours(option.value)}
                className={`rounded-full px-4 py-2 text-sm transition ${deadlineHours === option.value ? "bg-[var(--highlight)] text-white" : "border border-[var(--foreground)]/30 text-[var(--foreground)]/80"}`}
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
          className="mx-auto rounded-full bg-[var(--highlight)] px-8 py-2 text-sm text-white transition hover:brightness-95 disabled:opacity-60"
        >
          {isSubmitting ? "Submitting..." : "Create Bill on Monad"}
        </button>

        {error ? <p className="text-sm text-[var(--highlight)]">{error}</p> : null}

        {createTxHash ? (
          <a
            href={`https://testnet.monadscan.com/tx/${createTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[var(--highlight)] underline"
          >
            Create tx: {createTxHash}
          </a>
        ) : null}

        {createdBillId !== null ? (
          <div className="grid gap-3 rounded-xl border border-[var(--foreground)]/20 bg-white/55 p-3">
            <p className="text-sm text-[var(--foreground)]">Bill ID: {createdBillId.toString()}</p>
            <p className="text-xs text-[var(--foreground)]/65">Share link + QR are shown in the success modal.</p>
          </div>
        ) : null}
      </div>

      {isSuccessModalOpen && createdBillId !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#f9e2cf] p-5 shadow-xl">
            <h4 className="text-lg font-semibold text-[var(--foreground)]">Bill created on Monad</h4>
            <p className="mt-1 text-sm text-[var(--foreground)]/70">Share this QR so payers can open and pay from their phones.</p>

            {shareUrl ? (
              <div className="mt-4 grid gap-3">
                <div className="mx-auto w-fit rounded-lg bg-white p-2">
                  <QRCodeSVG value={shareUrl} size={220} includeMargin={true} />
                </div>
                <Link href={shareUrl} className="break-all text-sm text-[var(--highlight)] underline">
                  {shareUrl}
                </Link>
              </div>
            ) : null}

            <div className="mt-4 rounded-md border border-[var(--foreground)]/20 bg-white/55 p-3 text-sm">
              <p>Contract: <span className="font-mono">{contractAddress}</span></p>
              <p>Bill ID: <span className="font-mono">{createdBillId.toString()}</span></p>
              {createTxHash ? (
                <a
                  href={`https://testnet.monadscan.com/tx/${createTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-[var(--highlight)] underline"
                >
                  Open create tx in explorer
                </a>
              ) : null}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSuccessModalOpen(false)}
                className="rounded-full border border-[var(--highlight)] bg-[var(--highlight)] px-4 py-2 text-sm text-white"
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
