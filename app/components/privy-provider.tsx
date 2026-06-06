"use client";

import { useMemo } from "react";
import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";
import { usePrivy } from "@privy-io/react-auth";
import { monadTestnet } from "viem/chains";

type WalletLinkedAccount = {
  type: string;
  walletClientType?: string;
  chainType?: string;
  address?: string;
};

export function usePrivyWalletOwner() {
  const { user } = usePrivy();

  return useMemo(() => {
    const walletAccount = (user?.linkedAccounts ?? []).find((account) => {
      const linked = account as WalletLinkedAccount;
      return (
        linked.type === "wallet" &&
        linked.walletClientType === "privy" &&
        linked.chainType === "ethereum"
      );
    }) as WalletLinkedAccount | undefined;

    return walletAccount?.address ?? null;
  }, [user]);
}

export default function PrivyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BasePrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID!}
      config={{
        // Create embedded wallets for users who don't have a wallet
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
          priceDisplay: {
            primary: "native-token",
            secondary: null,
          },
        },
        defaultChain: monadTestnet,
        supportedChains: [monadTestnet],
      }}
    >
      {children}
    </BasePrivyProvider>
  );
}
