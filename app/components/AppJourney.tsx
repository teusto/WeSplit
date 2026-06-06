"use client";

import { useEffect, useRef, useState } from "react";
import { useLogin, usePrivy } from "@privy-io/react-auth";

import { CameraVision } from "./CameraVision";
import OnchainBillComposer from "./OnchainBillComposer";
import type { Bill } from "./CameraVision";

type JourneyView = "create-bill" | "bills-to-pay" | null;
type CreateFlowTab = "capture" | "bill";

export default function AppJourney() {
  const { ready, user, logout } = usePrivy();
  const { login } = useLogin();
  const [activeView, setActiveView] = useState<JourneyView>(null);
  const [extractedBill, setExtractedBill] = useState<Bill | null>(null);
  const [createFlowTab, setCreateFlowTab] = useState<CreateFlowTab>("capture");
  const [isWalletMenuOpen, setIsWalletMenuOpen] = useState(false);
  const createFlowRef = useRef<HTMLDivElement | null>(null);

  const connectedAddress =
    user?.wallet?.address ||
    user?.linkedAccounts?.find(
      (account) => account.type === "wallet" && "address" in account,
    )?.address ||
    null;

  const shortAddress = connectedAddress
    ? `${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}`
    : "Wallet connected";

  const handleBillReady = (bill: Bill) => {
    setExtractedBill(bill);
    setCreateFlowTab("bill");
  };

  useEffect(() => {
    if (activeView !== "create-bill") {
      return;
    }

    createFlowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeView]);

  if (!ready) {
    return <div className="text-center text-[var(--foreground)]/70">Loading wallet...</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-[var(--highlight)]/25 bg-white/40 p-8 text-center shadow-sm">
        <h2 className="mb-2 text-3xl text-[var(--foreground)]">Connect your wallet</h2>
        <p className="mb-6 text-[var(--foreground)]/70">Login to start creating and splitting bills.</p>
        <button
          type="button"
          onClick={() => login()}
          className="rounded-full border border-[var(--highlight)] bg-[var(--highlight)] px-6 py-2 text-base text-white transition hover:scale-[1.02]"
        >
          Login / Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-center">
      <div
        className={`mx-auto grid w-full max-w-2xl grid-cols-1 gap-3 transition-all duration-300 sm:grid-cols-2 ${
          activeView === "create-bill" ? "max-w-md" : "max-w-2xl"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setActiveView("create-bill");
            setCreateFlowTab("capture");
          }}
          className={`liquidGL min-h-[124px] rounded-2xl border px-4 text-center shadow-sm transition-all duration-300 hover:bg-[var(--orange)] hover:text-black ${
            activeView === "create-bill"
              ? "h-16 border-[var(--highlight)] bg-[var(--highlight)] text-sm text-white"
              : "border-[var(--foreground)]/35 bg-white/75 text-xl text-[var(--foreground)]"
          }`}
        >
          Create New Bill
        </button>

        <button
          type="button"
          onClick={() => setActiveView("bills-to-pay")}
          className={`liquidGL min-h-[124px] rounded-2xl border px-4 text-center shadow-sm transition-all duration-300 hover:bg-[var(--orange)] hover:text-black ${
            activeView === "bills-to-pay"
              ? "h-16 border-[var(--highlight)] bg-[var(--highlight)] text-sm text-white"
              : activeView === "create-bill"
                ? "h-16 border-[var(--foreground)]/35 bg-white/55 text-sm text-[var(--foreground)]/80"
                : "border-[var(--foreground)]/35 bg-white/75 text-xl text-[var(--foreground)]"
          }`}
        >
          See Bills to Pay
        </button>
      </div>

      <div className="fixed bottom-4 left-4 z-40 text-left">
        <button
          type="button"
          onClick={() => setIsWalletMenuOpen((prev) => !prev)}
          className="rounded-full border border-[var(--foreground)]/20 bg-white/85 px-3 py-1.5 text-xs text-[var(--foreground)] shadow-sm transition hover:border-[var(--highlight)]"
        >
          {shortAddress}
        </button>

        {isWalletMenuOpen ? (
          <div className="mt-2 w-40 rounded-xl border border-[var(--foreground)]/20 bg-[#f9e2cf] p-2 shadow-md">
            <button
              type="button"
              onClick={() => {
                setIsWalletMenuOpen(false);
                logout();
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-xs text-[var(--foreground)] transition hover:bg-[var(--highlight)] hover:text-white"
            >
              Logout
            </button>
          </div>
        ) : null}
      </div>

      {activeView === "create-bill" ? (
        <div ref={createFlowRef} className="mx-auto w-full max-w-3xl space-y-6 rounded-2xl border border-[var(--highlight)]/20 bg-white/35 p-5">
          <div className="mx-auto h-1 w-12 rounded-full bg-[var(--highlight)]" />

          <div className="mx-auto flex w-full max-w-md items-center justify-center rounded-full border border-[var(--foreground)]/20 bg-white/55 p-1">
            <button
              type="button"
              onClick={() => setCreateFlowTab("capture")}
              className={`flex-1 rounded-full px-4 py-2 text-sm transition ${
                createFlowTab === "capture"
                  ? "bg-[var(--highlight)] text-white"
                  : "text-[var(--foreground)]/75"
              }`}
            >
              Capture
            </button>
            <button
              type="button"
              onClick={() => {
                if (extractedBill) {
                  setCreateFlowTab("bill");
                }
              }}
              disabled={!extractedBill}
              className={`flex-1 rounded-full px-4 py-2 text-sm transition ${
                createFlowTab === "bill"
                  ? "bg-[var(--highlight)] text-white"
                  : "text-[var(--foreground)]/75"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Bill
            </button>
          </div>

          {createFlowTab === "capture" ? <CameraVision onBillReady={handleBillReady} /> : null}
          {createFlowTab === "bill" ? <OnchainBillComposer extractedBill={extractedBill} /> : null}
        </div>
      ) : null}

      {activeView === "bills-to-pay" ? (
        <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-[var(--foreground)]/30 bg-white/40 p-8 text-[var(--foreground)]/60">
          {/* Blank section for now, per requested journey */}
        </div>
      ) : null}
    </div>
  );
}
