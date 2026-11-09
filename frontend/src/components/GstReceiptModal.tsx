import React from "react";
import { Printer, X, CheckCircle } from "lucide-react";
import { GstInvoice } from "../api/client";
import { Lang, tDict } from "../i18n/translations";

interface GstReceiptModalProps {
  invoice: GstInvoice;
  lang: Lang;
  onClose: () => void;
}

export const GstReceiptModal: React.FC<GstReceiptModalProps> = ({
  invoice,
  lang,
  onClose,
}) => {
  const t = tDict[lang];
  const tb = invoice.tax_breakdown;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="no-print flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">
              {t.gstInvoiceTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs text-slate-800">
          <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
            <div>
              <div className="text-base font-bold text-slate-900">
                {invoice.institute_name}
              </div>
              <div className="text-slate-500 mt-0.5">
                GSTIN: <span className="font-mono font-semibold text-slate-700">{invoice.gstin}</span>
              </div>
              <div className="text-slate-500">
                SAC: {invoice.sac_code} | {invoice.place_of_supply}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold text-sm text-slate-900">
                {invoice.receipt_no}
              </div>
              <div className="text-slate-500 mt-0.5">{invoice.issued_at}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <div className="text-slate-500">Student Name & ID</div>
              <div className="font-semibold text-slate-900 mt-0.5">
                {invoice.student_name} ({invoice.student_id})
              </div>
            </div>
            <div>
              <div className="text-slate-500">Centre & Batch</div>
              <div className="font-semibold text-slate-900 mt-0.5">
                {invoice.centre} • {invoice.batch}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Instalment</div>
              <div className="font-semibold text-slate-900 mt-0.5">
                #{invoice.instalment_no} (Due {invoice.instalment_due_date})
              </div>
            </div>
            <div>
              <div className="text-slate-500">Payment Mode</div>
              <div className="font-semibold text-slate-900 mt-0.5">
                {invoice.payment_mode}
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="py-2 px-3 font-semibold">Tax Component</th>
                  <th className="py-2 px-3 text-right font-semibold">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-2 px-3">Taxable Coaching Fee Base</td>
                  <td className="py-2 px-3 text-right font-mono">
                    ₹{tb.taxable_base_inr.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3">CGST ({tb.cgst_rate_pct}%)</td>
                  <td className="py-2 px-3 text-right font-mono">
                    ₹{tb.cgst_amount_inr.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3">SGST ({tb.sgst_rate_pct}%)</td>
                  <td className="py-2 px-3 text-right font-mono">
                    ₹{tb.sgst_amount_inr.toFixed(2)}
                  </td>
                </tr>
                <tr className="bg-slate-50 font-bold text-slate-900 text-sm">
                  <td className="py-2.5 px-3">Total Receipt Amount (Inclusive of 18% GST)</td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    ₹{tb.total_paid_inr.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
            <span>
              Instalment Status:{" "}
              <strong className="text-slate-900">
                {invoice.instalment_summary.status}
              </strong>
            </span>
            <span>
              Remaining on Instalment:{" "}
              <strong className="text-slate-900">
                ₹{invoice.instalment_summary.remaining_balance_inr.toLocaleString("en-IN")}
              </strong>
            </span>
          </div>
        </div>

        <div className="no-print flex items-center justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
          >
            <Printer className="w-4 h-4" />
            {t.printReceiptBtn}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
          >
            {t.closeBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
