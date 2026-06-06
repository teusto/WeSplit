"use client";

type BillInfoProps = {
  total: string;
  currency: string;
  onTotalChange: (next: string) => void;
  onCurrencyChange: (next: string) => void;
};

const BillInfo = ({ total, currency, onTotalChange, onCurrencyChange }: BillInfoProps) => {
  return (
    <div className="rounded-xl border border-[var(--foreground)]/15 bg-white/50 p-4">
      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--foreground)]/70">
        Bill info
      </h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-[var(--foreground)]/70">Total (MON)</label>
          <input
            value={total}
            onChange={(e) => onTotalChange(e.target.value)}
            className="w-full rounded-md border border-[var(--foreground)]/20 bg-white/70 px-3 py-2"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--foreground)]/70">Currency metadata</label>
          <input
            value={currency}
            onChange={(e) => onCurrencyChange(e.target.value.toUpperCase())}
            className="w-full rounded-md border border-[var(--foreground)]/20 bg-white/70 px-3 py-2 uppercase"
            placeholder="EUR"
            maxLength={8}
          />
        </div>
      </div>
    </div>
  );
};

export default BillInfo;