"use client";

import { useEffect, useRef, useState } from "react";
import { useLogin, usePrivy } from "@privy-io/react-auth";

import { CameraVision } from "./CameraVision";
import OnchainBillComposer from "./OnchainBillComposer";
import type { Bill } from "./CameraVision";

type JourneyView = "create-bill" | "bills-to-pay" | null;

export default function AppJourney() {
  const { ready, user, logout } = usePrivy();
  const { login } = useLogin();
  const [activeView, setActiveView] = useState<JourneyView>(null);
  const [extractedBill, setExtractedBill] = useState<Bill | null>(null);
  const createFlowRef = useRef<HTMLDivElement | null>(null);

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
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={logout}
          className="rounded-full border border-[var(--foreground)]/30 px-4 py-1.5 text-sm text-[var(--foreground)]/80 transition hover:border-[var(--highlight)] hover:text-[var(--highlight)]"
        >
          Logout
        </button>
      </div>

      <div
        className={`mx-auto grid w-full max-w-2xl grid-cols-2 gap-3 transition-all duration-300 ${
          activeView === "create-bill" ? "max-w-md" : "max-w-2xl"
        }`}
      >
        <button
          type="button"
          onClick={() => setActiveView("create-bill")}
          className={`liquidGL rounded-2xl border px-4 text-center transition-all duration-300 ${
            activeView === "create-bill"
              ? "h-16 border-[var(--highlight)] bg-[var(--highlight)] text-sm text-white"
              : "aspect-square border-[var(--foreground)]/25 bg-white/60 text-xl"
          }`}
        >
          Create New Bill
        </button>

        <button
          type="button"
          onClick={() => setActiveView("bills-to-pay")}
          className={`liquidGL rounded-2xl border px-4 text-center transition-all duration-300 ${
            activeView === "bills-to-pay"
              ? "h-16 border-[var(--highlight)] bg-[var(--highlight)] text-sm text-white"
              : activeView === "create-bill"
                ? "h-16 border-[var(--foreground)]/25 bg-white/40 text-sm text-[var(--foreground)]/70"
                : "aspect-square border-[var(--foreground)]/25 bg-white/60 text-xl"
          }`}
        >
          See Bills to Pay
        </button>
      </div>

      {activeView === "create-bill" ? (
        <div ref={createFlowRef} className="mx-auto w-full max-w-3xl space-y-6 rounded-2xl border border-[var(--highlight)]/20 bg-white/35 p-5">
          <div className="mx-auto h-1 w-12 rounded-full bg-[var(--highlight)]" />
          <CameraVision onBillReady={setExtractedBill} />
          <OnchainBillComposer extractedBill={extractedBill} />
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
