import React, { useState } from "react";
import { X, CheckCircle2, ShieldAlert } from "lucide-react";
import {
  apiFetch,
  formatInr,
  GstInvoice,
  InstalmentItem,
} from "../api/client";
import { Lang, tDict } from "../i18n/translations";

interface PaymentModalProps {
  instalment: InstalmentItem;
  studentName: string;
  lang: Lang;
  onClose: () => void;
  onSuccess: (invoice: GstInvoice) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  instalment,
  studentName,
  lang,
  onClose,
  onSuccess,
}) => {
  const t = tDict[lang];
  const remaining = instalment.remaining_balance;

  const [payType, setPayType] = useState<"FULL" | "PARTIAL">("FULL");
  const [partialAmount, setPartialAmount] = useState<string>(
    String(Math.min(5000, remaining))
  );
  const [paymentMode, setPaymentMode] = useState<string>("UPI");
  const [idempotencyKey] = useState<string>(
    () => `pay-${instalment.id}-${Date.now()}`
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveAmount =
    payType === "FULL" ? remaining : Number(partialAmount || 0);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!Number.isInteger(effectiveAmount) || effectiveAmount <= 0) {
      setError("Please enter a valid whole-rupee amount greater than ₹0.");
      return;
    }
    if (effectiveAmount > remaining) {
      setError(
        `Overpayment not allowed: maximum payable for this instalment is ${formatInr(
          remaining
        )}.`
      );
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiFetch<{
        instalment: InstalmentItem;
        gst_invoice: GstInvoice;
      }>(`/instalments/${instalment.id}/pay`, {
        method: "POST",
        body: JSON.stringify({
          amount: effectiveAmount,
          idempotency_key: idempotencyKey,
          payment_mode: paymentMode,
        }),
      });
      onSuccess(res.gst_invoice);
    } catch (err: any) {
      setError(err.message || "Payment failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {t.paymentModalTitle}
            </h3>
            <p className="text-xs text-slate-500">
              {studentName} • {t.instalmentWord} #{instalment.instalment_no}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handlePay} className="p-5 space-y-4">
          <div className="space-y-2">
            <label
              onClick={() => setPayType("FULL")}
              className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition ${
                payType === "FULL"
                  ? "border-slate-900 bg-slate-50"
                  : "border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="radio"
                  checked={payType === "FULL"}
                  onChange={() => setPayType("FULL")}
                  className="text-slate-900"
                />
                <span className="text-sm font-medium text-slate-800">
                  {t.payFullBalance}
                </span>
              </div>
              <span className="text-sm font-bold text-slate-900">
                {formatInr(remaining)}
              </span>
            </label>

            <label
              onClick={() => setPayType("PARTIAL")}
              className={`block p-3.5 rounded-xl border cursor-pointer transition ${
                payType === "PARTIAL"
                  ? "border-slate-900 bg-slate-50"
                  : "border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="radio"
                  checked={payType === "PARTIAL"}
                  onChange={() => setPayType("PARTIAL")}
                  className="text-slate-900"
                />
                <span className="text-sm font-medium text-slate-800">
                  {t.payPartialAmount}
                </span>
              </div>
              {payType === "PARTIAL" && (
                <div className="mt-3">
                  <label className="block text-xs text-slate-500 mb-1">
                    {t.enterPartialInr} (Max {formatInr(remaining)})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={remaining}
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              )}
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t.paymentMethodLabel}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["UPI", "CARD", "NETBANKING"].map((mode) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => setPaymentMode(mode)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                    paymentMode === mode
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{t.inclusiveGstNote}</span>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2 font-medium">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-sm transition shadow-sm"
          >
            {submitting
              ? t.processingPayment
              : `${t.confirmPayBtn} • ${formatInr(
                  effectiveAmount > 0 ? effectiveAmount : 0
                )}`}
          </button>
        </form>
      </div>
    </div>
  );
};
