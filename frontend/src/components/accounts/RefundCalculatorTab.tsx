import React, { useEffect, useState } from "react";
import { Calculator, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { apiFetch, formatInr } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

interface RefundCalculatorTabProps {
  refreshSignal: number;
}

export const RefundCalculatorTab: React.FC<RefundCalculatorTabProps> = ({
  refreshSignal,
}) => {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState<string>("STU-0412");
  const [exitDate, setExitDate] = useState<string>("2026-11-02");
  const [preview, setPreview] = useState<any | null>(null);
  const [issuedRefunds, setIssuedRefunds] = useState<any[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadPreviewAndHistory = async () => {
    try {
      setError(null);
      const [calcRes, listRes] = await Promise.all([
        apiFetch<any>("/accounts/refunds/calculate", {
          method: "POST",
          body: JSON.stringify({ student_id: studentId, exit_date: exitDate }),
        }),
        apiFetch<{ refunds: any[] }>("/accounts/refunds"),
      ]);
      setPreview(calcRes);
      setIssuedRefunds(listRes.refunds);
    } catch (err: any) {
      setError(err.message || "Refund calculation failed");
    }
  };

  useEffect(() => {
    loadPreviewAndHistory();
  }, [studentId, exitDate, refreshSignal]);

  const handleIssueRefund = async () => {
    try {
      setBusy(true);
      setError(null);
      setToast(null);
      await apiFetch("/accounts/refunds/issue", {
        method: "POST",
        body: JSON.stringify({ student_id: studentId, exit_date: exitDate }),
      });
      setToast(
        `Withdrawal & Pro-Rata Refund recorded for ${studentId}. Student marked WITHDRAWN and reminders cancelled.`
      );
      await loadPreviewAndHistory();
    } catch (err: any) {
      setError(err.message || "Could not issue refund");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Policy & Interactive Pro-Rata Calculator */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-sm">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-slate-700" />
              MoE 2024 Pro-Rata Refund Calculator
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enforces the written 300-day session policy, ₹1,500 registration
              fee deduction, and 10-day statutory SLA from request date.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Student
            </label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 bg-white"
            >
              <option value="STU-0412">
                STU-0412 • Aarav Meena (₹90,000 Paid → ₹3,575 Refund)
              </option>
              <option value="STU-0587">
                STU-0587 • Ishita Sharma (₹75,000 Paid → Shortfall Demo)
              </option>
              <option value="STU-0219">
                STU-0219 • Mohit Gurjar (₹80,000 Paid)
              </option>
              <option value="STU-0804">
                STU-0804 • Kunal Kachhwaha (₹70,000 Paid, Scholarship)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Last Date Attended (Exit Date)
            </label>
            <input
              type="date"
              min="2026-04-01"
              max="2026-11-02"
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono font-semibold text-slate-900"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {toast && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {toast}
          </div>
        )}

        {preview && (
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2.5 text-xs">
            <div className="font-bold text-slate-900 border-b border-slate-200 pb-2 flex justify-between">
              <span>Step-by-Step Policy Breakdown ({preview.student_name})</span>
              <span className="font-mono text-slate-500">
                Status: {preview.student_status}
              </span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>
                1. Course Window ({preview.course_start_date} to{" "}
                {preview.exit_date})
              </span>
              <span className="font-mono font-semibold text-slate-900">
                {preview.days_attended} / {preview.total_session_days} days
                attended
              </span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>
                2. Net Annual Fee ({formatInr(preview.gross_fee)} −{" "}
                {formatInr(preview.discount)} discount)
              </span>
              <span className="font-mono font-semibold text-slate-900">
                {formatInr(preview.net_fee)}
              </span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>
                3. Less Non-Refundable Registration Component (Assumption A3)
              </span>
              <span className="font-mono">
                −{formatInr(preview.non_refundable_reg_fee)} (Allocable:{" "}
                {formatInr(preview.allocable_course_fee)})
              </span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>
                4. Daily Pro-Rata Rate ({formatInr(preview.allocable_course_fee)}{" "}
                ÷ 300 days)
              </span>
              <span className="font-mono font-semibold text-slate-900">
                ₹{preview.daily_rate_inr.toFixed(2)} / day
              </span>
            </div>

            <div className="flex justify-between text-slate-800 font-semibold border-t border-slate-200 pt-2">
              <span>
                5. Total Fee Utilized (₹1,500 + {preview.days_attended}d × ₹
                {preview.daily_rate_inr})
              </span>
              <span className="font-mono">
                {formatInr(preview.pro_rata_fee_utilized)}
              </span>
            </div>

            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>6. Total Fee Paid by Parent to Date</span>
              <span className="font-mono">
                {formatInr(preview.total_paid_to_date)}
              </span>
            </div>

            <div className="border-t border-slate-300 pt-3 flex items-center justify-between text-sm">
              <span className="font-bold text-slate-900">
                Net Pro-Rata Refundable Amount:
              </span>
              <span className="text-xl font-extrabold text-emerald-700 font-mono">
                {formatInr(preview.refundable_amount)}
              </span>
            </div>

            {preview.shortfall_receivable > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex justify-between font-semibold">
                <span>
                  Shortfall Receivable (Consumed fee exceeds amount paid):
                </span>
                <span className="font-mono">
                  {formatInr(preview.shortfall_receivable)}
                </span>
              </div>
            )}

            <div className="text-[11px] text-slate-500 pt-1">
              MoE 2024 10-Day Refund Payout Deadline (from Request Date{" "}
              {preview.request_date}):{" "}
              <strong className="text-slate-800">
                {preview.sla_deadline_date}
              </strong>
            </div>
          </div>
        )}

        {user?.role === "ACCOUNTS" ? (
          <button
            disabled={busy || preview?.student_status === "WITHDRAWN"}
            onClick={handleIssueRefund}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs transition"
          >
            {preview?.student_status === "WITHDRAWN"
              ? "Student Already Withdrawn & Refund Recorded"
              : "Approve Withdrawal, Cancel Future Reminders & Issue Refund"}
          </button>
        ) : (
          <div className="p-3 rounded-xl bg-slate-100 text-xs text-slate-600 text-center">
            Read-Only Preview: Only <strong>ACCOUNTS</strong> role can approve
            and issue financial refunds.
          </div>
        )}
      </div>

      {/* Right Column: Active 10-Day SLA Refund Tracker */}
      <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-700" />
            Issued Refunds & 10-Day MoE SLA Log
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tracks statutory 10-day processing countdown and GST credit notes.
          </p>
        </div>

        {issuedRefunds.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
            No refunds issued yet. Select Aarav Meena (STU-0412) on the left and
            click Approve to test the ₹3,575 refund and withdrawal side-effects.
          </div>
        ) : (
          <div className="space-y-3">
            {issuedRefunds.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    {r.student_name} ({r.student_id})
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    SLA: {r.sla_days_remaining}d left (Due {r.sla_deadline_date})
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Days Attended: {r.days_attended}d</span>
                  <span>Utilized: {formatInr(r.pro_rata_fee_utilized)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Refundable: {formatInr(r.refundable_amount)}</span>
                  {r.shortfall_receivable > 0 && (
                    <span className="text-amber-800">
                      Shortfall: {formatInr(r.shortfall_receivable)}
                    </span>
                  )}
                  {r.gst_credit_note_no && (
                    <span className="font-mono text-slate-600">
                      CN: {r.gst_credit_note_no}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
