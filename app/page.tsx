import type { Metadata } from "next";

import { InstallPWA } from "./components/InstallPWA";
import AppJourney from "./components/AppJourney";

export const metadata: Metadata = {
  title: "Home",
};

export default function Page() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-10 text-center">
        <div className="mb-10 space-y-3">
          <div className="flex items-center justify-center">
            <img src="/logo.png" alt="Logo" className="h-16 w-16" />
          </div>
          <h1 className="text-5xl leading-tight">WE SPLIT</h1>
          <p className="text-base text-[var(--foreground)]/70">
            Split bills on Monad with a clean camera-to-payment flow.
          </p>
          <div className="mx-auto h-1 w-16 rounded-full bg-[var(--highlight)]" />
        </div>

        <div className="w-full">
          <AppJourney />
        </div>

        <div className="mt-6 h-1 w-10 rounded-full bg-[var(--highlight)]/40" />
      </div>

      <div className="pb-4">
        <InstallPWA />
      </div>
    </div>
  );
}
