import React, { useEffect, useState } from "react";
import {
  FileText,
  BellOff,
  Send,
  Globe,
  CreditCard,
  CheckCircle2,
} from "lucide-react";
import {
  apiFetch,
  formatInr,
  GstInvoice,
  InstalmentItem,
} from "../../api/client";
import { PaymentModal } from "../PaymentModal";
import { GstReceiptModal } from "../GstReceiptModal";

interface LedgerAndRemindersTabProps {
  selectedStudentId: string;
  onSelectStudentId: (id: string) => void;
  refreshSignal: number;
  subView: "LEDGER" | "REMINDERS";
}

const ALL_STUDENT_IDS = [
  { id: "STU-0587", label: "STU-0587 • Ishita Sharma (Part-Paid, 23d Overdue)" },
  { id: "STU-0412", label: "STU-0412 • Aarav Meena (All Current Paid)" },
  { id: "STU-0219", label: "STU-0219 • Mohit Gurjar (Due in 13 Days)" },
  { id: "STU-0641", label: "STU-0641 • Devansh Rathore (79d Overdue)" },
  { id: "STU-0710", label: "STU-0710 • Priyanshi Joshi (43d Overdue)" },
  { id: "STU-0804", label: "STU-0804 • Kunal Kachhwaha (Scholarship)" },
];

export const LedgerAndRemindersTab: React.FC<LedgerAndRemindersTabProps> = ({
  selectedStudentId,
  onSelectStudentId,
  refreshSignal,
  subView,
}) => {
  const [ledger, setLedger] = useState<any | null>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [previewLang, setPreviewLang] = useState<"en" | "hi">("en");
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<string | null>(null);

  const [payingInstalment, setPayingInstalment] =
    useState<InstalmentItem | null>(null);
  const [activeInvoice, setActiveInvoice] = useState<GstInvoice | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      if (subView === "LEDGER") {
        const res = await apiFetch<any>(
          `/accounts/students/${selectedStudentId}`
        );
        setLedger(res);
      } else {
        const query =
          statusFilter !== "ALL" ? `?status_filter=${statusFilter}` : "";
        const res = await apiFetch<{ reminders: any[] }>(
          `/accounts/reminders${query}`
        );
        setReminders(res.reminders);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStudentId, statusFilter, subView, refreshSignal]);

  const handleOpenReceipt = async (receiptNo: string) => {
    const inv = await apiFetch<GstInvoice>(`/receipts/${receiptNo}`);
    setActiveInvoice(inv);
  };

  const handleDispatchDueReminders = async () => {
    const res = await apiFetch<any>("/accounts/reminders/dispatch", {
      method: "POST",
    });
    setToast(
      `Scheduler tick: ${res.sent_count} sent, ${res.stopped_at_send_time_count} stopped by send-time payment check`
    );
    await loadData();
  };

  if (loading) {
    return <div className="h-72 rounded-2xl bg-slate-200 animate-pulse" />;
  }

  if (subView === "REMINDERS") {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            {["ALL", "SCHEDULED", "SENT", "STOPPED_ON_PAYMENT"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  statusFilter === st
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {st === "STOPPED_ON_PAYMENT"
                  ? "Stopped on Payment (Kill-Switch)"
                  : st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {toast && (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg">
                {toast}
              </span>
            )}
            <button
              onClick={() =>
                setPreviewLang(previewLang === "en" ? "hi" : "en")
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800"
            >
              <Globe className="w-3.5 h-3.5" />
              {previewLang === "en" ? "Preview: English" : "Preview: हिंदी"}
            </button>
            <button
              onClick={handleDispatchDueReminders}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold"
            >
              <Send className="w-3.5 h-3.5" />
              Run Due Dispatch Tick
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-sm">
          {reminders.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No reminders match this status filter.
            </div>
          ) : (
            reminders.map((rem) => (
              <div
                key={rem.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {rem.student_name} ({rem.student_id})
                    </span>
                    <span className="text-slate-500">
                      • Inst #{rem.instalment_no} • {rem.trigger_type}
                    </span>
                    <span className="font-mono text-slate-500">
                      ({rem.scheduled_date})
                    </span>
                  </div>
                  <p className="text-slate-800 font-medium">
                    {previewLang === "hi" ? rem.message_hi : rem.message_en}
                  </p>
                  {rem.stopped_reason && (
                    <div className="text-emerald-700 font-semibold">
                      Kill-Switch Audit: {rem.stopped_reason}
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                      rem.status === "STOPPED_ON_PAYMENT"
                        ? "bg-emerald-100 text-emerald-800"
                        : rem.status === "SENT"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {rem.status === "STOPPED_ON_PAYMENT" && (
                      <BellOff className="w-3.5 h-3.5" />
                    )}
                    {rem.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (!ledger) return null;
  const st = ledger.student;

  return (
    <div className="space-y-5">
      {/* Student Selector Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-600">
            Inspect Student Ledger:
          </label>
          <select
            value={selectedStudentId}
            onChange={(e) => onSelectStudentId(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 bg-white"
          >
            {ALL_STUDENT_IDS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span>
            Gross Fee: <strong>{formatInr(st.gross_annual_fee)}</strong>
          </span>
          <span>
            Discount:{" "}
            <strong className="text-emerald-700">
              -{formatInr(st.scholarship_discount)}
            </strong>
          </span>
          <span>
            Net Fee: <strong>{formatInr(st.net_annual_fee)}</strong>
          </span>
          <span>
            Total Paid:{" "}
            <strong className="text-emerald-700">
              {formatInr(st.total_paid)}
            </strong>
          </span>
          <span>
            Balance:{" "}
            <strong className="text-red-700">
              {formatInr(st.total_balance)}
            </strong>
          </span>
        </div>
      </div>

      {/* Instalment Schedule Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Instalment Schedule & Counter Payment Recording ({st.name})
          </h3>
          <span className="text-xs text-slate-500">
            {st.centre} • {st.batch}
          </span>
        </div>
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Instalment</th>
              <th className="py-3 px-4">Due Date</th>
              <th className="py-3 px-4 text-right">Amount Due</th>
              <th className="py-3 px-4 text-right">Paid</th>
              <th className="py-3 px-4 text-right">Balance</th>
              <th className="py-3 px-4">Status & Overdue</th>
              <th className="py-3 px-4 text-right">Receipt / Counter Pay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ledger.instalments.map((inst: InstalmentItem) => (
              <tr key={inst.id}>
                <td className="py-3 px-4 font-bold text-slate-900">
                  #{inst.instalment_no}
                </td>
                <td className="py-3 px-4 font-mono">{inst.due_date}</td>
                <td className="py-3 px-4 text-right font-mono">
                  {formatInr(inst.amount_due)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">
                  {formatInr(inst.amount_paid)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold">
                  {formatInr(inst.remaining_balance)}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      inst.status === "PAID"
                        ? "bg-emerald-100 text-emerald-800"
                        : inst.status.includes("OVERDUE")
                        ? "bg-red-100 text-red-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {inst.status}
                  </span>
                  {inst.days_overdue > 0 && (
                    <span className="ml-2 text-red-600 font-semibold">
                      ({inst.days_overdue}d late)
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right space-x-2">
                  {inst.latest_receipt_no && (
                    <button
                      onClick={() => handleOpenReceipt(inst.latest_receipt_no!)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-semibold text-slate-700"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {inst.latest_receipt_no}
                    </button>
                  )}
                  {inst.remaining_balance > 0 && st.status !== "WITHDRAWN" && (
                    <button
                      onClick={() => setPayingInstalment(inst)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-900 text-white font-semibold"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Record Payment
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Student-Specific Reminder Log Strip */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-900">
            Student Reminder Kill-Switch Audit Trail
          </h4>
          <span className="text-[11px] text-slate-500">
            Full payment automatically transitions scheduled reminders to
            STOPPED_ON_PAYMENT
          </span>
        </div>
        {ledger.reminders.map((rem: any) => (
          <div
            key={rem.id}
            className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
          >
            <div>
              <div className="font-semibold text-slate-800">
                {rem.trigger_type} ({rem.scheduled_date})
              </div>
              <div className="text-slate-600 mt-0.5">{rem.message_en}</div>
              {rem.stopped_reason && (
                <div className="text-emerald-700 font-semibold mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                  {rem.stopped_reason}
                </div>
              )}
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                rem.status === "STOPPED_ON_PAYMENT"
                  ? "bg-emerald-100 text-emerald-800"
                  : rem.status === "SENT"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {rem.status}
            </span>
          </div>
        ))}
      </div>

      {payingInstalment && (
        <PaymentModal
          instalment={payingInstalment}
          studentName={st.name}
          lang="en"
          onClose={() => setPayingInstalment(null)}
          onSuccess={(inv) => {
            setPayingInstalment(null);
            setActiveInvoice(inv);
            loadData();
          }}
        />
      )}

      {activeInvoice && (
        <GstReceiptModal
          invoice={activeInvoice}
          lang="en"
          onClose={() => setActiveInvoice(null)}
        />
      )}
    </div>
  );
};
