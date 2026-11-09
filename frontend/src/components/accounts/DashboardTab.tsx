import React, { useEffect, useState } from "react";
import {
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  RefreshCw,
  PlusCircle,
} from "lucide-react";
import { API_BASE, apiFetch, formatInr } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

interface DashboardTabProps {
  refreshSignal: number;
  onSelectStudent: (studentId: string) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  refreshSignal,
  onSelectStudent,
}) => {
  const { user } = useAuth();
  const [centre, setCentre] = useState<string>("ALL");
  const [batch, setBatch] = useState<string>("ALL");
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Unmatched Payments Drawer / Modal State
  const [showUnmatchedModal, setShowUnmatchedModal] = useState(false);
  const [unmatchedData, setUnmatchedData] = useState<{
    unmatched_payments: any[];
    candidate_instalments: any[];
  } | null>(null);
  const [selectedTargetMap, setSelectedTargetMap] = useState<
    Record<number, number>
  >({});
  const [actionBusy, setActionBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Bulk Upload Modal State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkJsonText, setBulkJsonText] = useState<string>(
    JSON.stringify(
      [
        {
          student_id: "STU-0587",
          attendance_pct: 62.0,
          test_scores: [72.0, 60.0, 48.0],
        },
        {
          student_id: "STU-0219",
          attendance_pct: 91.0,
          test_scores: [76.0, 79.0, 82.0],
        },
      ],
      null,
      2
    )
  );

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams();
      if (centre !== "ALL") query.set("centre", centre);
      if (batch !== "ALL") query.set("batch", batch);
      const res = await apiFetch<any>(
        `/accounts/dashboard?${query.toString()}`
      );
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [centre, batch, refreshSignal]);

  const loadUnmatchedQueue = async () => {
    try {
      const res = await apiFetch<{
        unmatched_payments: any[];
        candidate_instalments: any[];
      }>("/accounts/unmatched");
      setUnmatchedData(res);
      const defaults: Record<number, number> = {};
      res.unmatched_payments.forEach((u) => {
        const match = res.candidate_instalments.find(
          (c) => c.remaining_balance === u.amount
        );
        if (match) defaults[u.id] = match.instalment_id;
        else if (res.candidate_instalments[0]) {
          defaults[u.id] = res.candidate_instalments[0].instalment_id;
        }
      });
      setSelectedTargetMap(defaults);
    } catch (err: any) {
      setError(err.message || "Could not load unmatched queue");
    }
  };

  const handleOpenUnmatched = async () => {
    setShowUnmatchedModal(true);
    await loadUnmatchedQueue();
  };

  const handleReconcile = async (unmatchedId: number) => {
    const targetInstalmentId = selectedTargetMap[unmatchedId];
    if (!targetInstalmentId) return;
    try {
      setActionBusy(true);
      const res = await apiFetch<any>(
        `/accounts/unmatched/${unmatchedId}/reconcile`,
        {
          method: "POST",
          body: JSON.stringify({ target_instalment_id: targetInstalmentId }),
        }
      );
      setToast(
        `Matched bank transfer to Instalment #${res.instalment.instalment_no} • Receipt ${res.receipt_no}`
      );
      await loadUnmatchedQueue();
      await loadDashboard();
    } catch (err: any) {
      alert(err.message || "Reconciliation failed");
    } finally {
      setActionBusy(false);
    }
  };

  const handleSimulateUnmatchedWebhook = async () => {
    try {
      setActionBusy(true);
      const randSuffix = Math.floor(100000 + Math.random() * 900000);
      await apiFetch("/webhooks/bank-transfer", {
        method: "POST",
        body: JSON.stringify({
          utr_reference: `UTR20261102${randSuffix}`,
          amount: 15000,
          payer_phone: "9414088888",
          raw_narration: `NEFT/UNKNOWN-REMARK-${randSuffix}/JAIPUR`,
        }),
      });
      setToast("Simulated unmatched NEFT webhook added to queue");
      await loadUnmatchedQueue();
      await loadDashboard();
    } catch (err: any) {
      alert(err.message || "Webhook simulation failed");
    } finally {
      setActionBusy(false);
    }
  };

  const handleExportTallyXml = async () => {
    try {
      const token = localStorage.getItem("jaipur_jwt");
      const res = await fetch(`${API_BASE}/accounts/export-tally`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Export failed" }));
        throw new Error(err.detail || "Export failed");
      }
      const xmlBlob = await res.blob();
      const url = window.URL.createObjectURL(xmlBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "jaipur_coaching_tally_vouchers.xml";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setToast("Tally XML Vouchers exported");
    } catch (err: any) {
      alert(err.message || "Tally export requires ACCOUNTS role");
    }
  };

  const handleBulkUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionBusy(true);
      const parsed = JSON.parse(bulkJsonText);
      const res = await apiFetch<any>("/accounts/bulk-upload", {
        method: "POST",
        body: JSON.stringify({ records: parsed }),
      });
      setToast(
        `Updated ${res.updated_count} students & recalculated AI dropout risk`
      );
      setShowBulkModal(false);
      await loadDashboard();
    } catch (err: any) {
      alert(err.message || "Invalid JSON payload for bulk upload");
    } finally {
      setActionBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-28 rounded-2xl bg-slate-200 animate-pulse"
            />
          ))}
        </div>
        <div className="h-80 rounded-2xl bg-slate-200 animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-5 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700">
        {error || "Unable to load dashboard"}
      </div>
    );
  }

  const { kpis, filters, students } = data;

  return (
    <div className="space-y-6">
      {/* Filter & Actions Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
              Jaipur Centre
            </label>
            <select
              value={centre}
              onChange={(e) => setCentre(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="ALL">All 4 Centres</option>
              {filters.available_centres.map((c: string) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
              Batch
            </label>
            <select
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white"
            >
              <option value="ALL">All Batches</option>
              {filters.available_batches.map((b: string) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4">
            <span className="text-xs text-slate-500">
              Reference Clock:{" "}
              <strong className="font-mono text-slate-800">
                {data.reference_date}
              </strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {toast && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
              {toast}
            </span>
          )}

          {user?.role === "ACCOUNTS" && (
            <button
              onClick={handleOpenUnmatched}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Unmatched Queue ({kpis.unmatched_queue_count} •{" "}
              {formatInr(kpis.unmatched_queue_inr)})
            </button>
          )}

          <button
            onClick={() => setShowBulkModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            Bulk Upload Attendance / Tests
          </button>

          {user?.role === "ACCOUNTS" && (
            <button
              onClick={handleExportTallyXml}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Export Tally XML
            </button>
          )}
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">
            Net Annual Fee Billed
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            {formatInr(kpis.total_billed_inr)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {students.length} enrolled students in view
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">
            Total Collected to Date
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">
            {formatInr(kpis.total_collected_inr)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Matured value: {formatInr(kpis.matured_instalment_value_inr)}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">
            Ageing Buckets (0–30d / 31–60d)
          </div>
          <div className="text-lg font-bold text-slate-900 mt-1">
            {formatInr(kpis.ageing_0_30_inr)}{" "}
            <span className="text-slate-400 font-normal">/</span>{" "}
            <span className="text-amber-700">
              {formatInr(kpis.ageing_31_60_inr)}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Automated bilingual reminders active
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Over 60 Days Late (KPI Target: 6%)
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                kpis.over_60_days_pct <= 6.0
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {kpis.over_60_days_pct}% of matured
            </span>
          </div>
          <div className="text-2xl font-extrabold text-red-700 mt-1">
            {formatInr(kpis.ageing_over_60_inr)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Denominator: {formatInr(kpis.matured_instalment_value_inr)} matured
          </div>
        </div>
      </div>

      {/* Student Ledger & Ageing Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Student Dues & Ageing Ledger
            </h3>
            <p className="text-xs text-slate-500">
              Click any student row to inspect their full instalment schedule,
              GST receipts, and reminder kill-switch state.
            </p>
          </div>
        </div>

        {students.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No students match the selected Jaipur centre and batch filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Student ID & Name</th>
                  <th className="py-3 px-4 font-semibold">Centre & Batch</th>
                  <th className="py-3 px-4 text-right font-semibold">
                    Net Annual Fee
                  </th>
                  <th className="py-3 px-4 text-right font-semibold">
                    Paid to Date
                  </th>
                  <th className="py-3 px-4 text-right font-semibold">
                    Overdue Now
                  </th>
                  <th className="py-3 px-4 font-semibold">Ageing Status</th>
                  <th className="py-3 px-4 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((st: any) => (
                  <tr
                    key={st.student_id}
                    onClick={() => onSelectStudent(st.student_id)}
                    className="hover:bg-slate-50 cursor-pointer transition"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{st.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {st.student_id}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">
                        {st.batch}
                      </div>
                      <div className="text-slate-500">{st.centre}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      {formatInr(st.net_annual_fee)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-700 font-semibold">
                      {formatInr(st.total_paid)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      {st.overdue_balance > 0 ? (
                        <span className="text-red-700">
                          {formatInr(st.overdue_balance)}
                        </span>
                      ) : (
                        <span className="text-slate-400">₹0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {st.status === "WITHDRAWN" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-700">
                          WITHDRAWN
                        </span>
                      ) : st.max_days_overdue > 60 ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800">
                          {st.max_days_overdue}d overdue (Over 60d)
                        </span>
                      ) : st.max_days_overdue > 0 ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                          {st.max_days_overdue} days overdue
                        </span>
                      ) : st.next_due_date ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800">
                          Next due {st.next_due_date}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          All Paid
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-slate-900 font-semibold hover:underline">
                        Open Ledger
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Unmatched Bank Transfers Queue Modal */}
      {showUnmatchedModal && unmatchedData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Unmatched Bank Transfers Queue (Guardrail Active)
                </h3>
                <p className="text-xs text-slate-500">
                  Payments without an exact student or instalment reference sit
                  here safely instead of marking any ledger paid automatically.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={actionBusy}
                  onClick={handleSimulateUnmatchedWebhook}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Simulate Unknown NEFT Webhook
                </button>
                <button
                  onClick={() => setShowUnmatchedModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-3 text-xs">
              {unmatchedData.unmatched_payments.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No unmatched bank transfers in queue.
                </div>
              ) : (
                unmatchedData.unmatched_payments.map((u) => (
                  <div
                    key={u.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">
                          {u.utr_reference}
                        </span>
                        <span className="text-sm font-extrabold text-slate-900">
                          {formatInr(u.amount)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.status === "MATCHED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {u.status} ({u.mismatch_reason})
                        </span>
                      </div>
                      <div className="text-slate-600 mt-1">
                        Payer Phone: {u.payer_phone} • Narration:{" "}
                        <span className="font-mono">{u.raw_narration}</span>
                      </div>
                    </div>

                    {u.status === "QUEUED" ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedTargetMap[u.id] || ""}
                          onChange={(e) =>
                            setSelectedTargetMap({
                              ...selectedTargetMap,
                              [u.id]: Number(e.target.value),
                            })
                          }
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white"
                        >
                          {unmatchedData.candidate_instalments.map((c) => (
                            <option
                              key={c.instalment_id}
                              value={c.instalment_id}
                            >
                              {c.student_name} ({c.student_id}) • Inst #
                              {c.instalment_no} • Bal{" "}
                              {formatInr(c.remaining_balance)}
                            </option>
                          ))}
                        </select>
                        <button
                          disabled={actionBusy}
                          onClick={() => handleReconcile(u.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                        >
                          Match & Issue GST Receipt
                        </button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        Matched to {u.matched_student_id}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Attendance & Test Scores Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                Bulk Upload Batch Attendance & Mock Test Scores
              </h3>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleBulkUploadSubmit} className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                Paste batch attendance (%) and recent mock test scores below.
                Submitting updates the student records and immediately
                recomputes AI dropout-risk flags.
              </p>
              <textarea
                rows={9}
                value={bulkJsonText}
                onChange={(e) => setBulkJsonText(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Upload & Recompute AI Risk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
