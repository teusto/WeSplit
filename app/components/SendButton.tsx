"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

// When user clicks this button it will send an link of onboarding to the numbers added on the list of split members of the bill.

type BillPayer = {
  id: string;
  name?: string;
  phone?: string;
};

type Bill = {
  value: number;
  currency: string;
  owner: string;
  payers: BillPayer[];
};

type SendButtonProps = {
  bill: Bill;
};

const SendButton = ({ bill }: SendButtonProps) => {
  const [showQr, setShowQr] = useState(false);

  const qrPayload = useMemo(
    () =>
      JSON.stringify({
        action: "join-bill-as-payer",
        bill,
      }),
    [bill],
  );

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <button type="button" onClick={() => setShowQr((prev) => !prev)}>
        {showQr ? "Hide Bill QR" : "Generate Bill QR"}
      </button>

      {showQr ? (
        <div
          style={{
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            padding: 12,
            borderRadius: 8,
            background: "#f8fafc",
          }}
        >
          <QRCodeSVG value={qrPayload} size={220} level="M" includeMargin={true} />
          <p style={{ margin: 0, fontSize: 12, color: "#475569" }}>
            Ask payer to scan this QR to join this bill.
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default SendButton;