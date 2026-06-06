"use client";

type BillInfoProps = {
  total: string;
  currency: string;
  onTotalChange: (next: string) => void;
  onCurrencyChange: (next: string) => void;
};

const BillInfo = ({ total, currency, onTotalChange, onCurrencyChange }: BillInfoProps) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        Bill info
      </h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">Total (MON)</label>
          <input
            value={total}
            onChange={(e) => onTotalChange(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">Currency metadata</label>
          <input
            value={currency}
            onChange={(e) => onCurrencyChange(e.target.value.toUpperCase())}
            className="w-full rounded-md border border-slate-300 px-3 py-2 uppercase dark:border-slate-600 dark:bg-slate-800"
            placeholder="EUR"
            maxLength={8}
          />
        </div>
      </div>
    </div>
  );
};

export default BillInfo;