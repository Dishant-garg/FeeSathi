import React, { useEffect, useState } from "react";
import {
  ShieldAlert,
  PhoneCall,
  FlagOff,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { apiFetch } from "../../api/client";

interface AiRiskQueueTabProps {
  refreshSignal: number;
}

export const AiRiskQueueTab: React.FC<AiRiskQueueTabProps> = ({
  refreshSignal,
}) => {
  const [data, setData] = useState<{
    reference_date: string;
    valid_dismiss_reasons: string[];
    assessments: any[];
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<string | null>(null);

  // False-Flag Override Modal state
  const [dismissTarget, setDismissTarget] = useState<any | null>(null);
  const [dismissReason, setDismissReason] = useState<string>("MEDICAL_LEAVE");
  const [dismissNotes, setDismissNotes] = useState<string>(
    "Verified medical certificate with parent over phone."
  );

  // Complete Counsellor Call Modal state
  const [callTarget, setCallTarget] = useState<any | null>(null);
  const [callNotes, setCallNotes] = useState<string>(
    "Spoke with parent; scheduled extra doubt-clearing session for Physics."
  );

  const loadRiskQueue = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<any>("/accounts/ai-risk");
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRiskQueue();
  }, [refreshSignal]);

  const handleConfirmDismiss = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dismissTarget) return;
    await apiFetch(`/accounts/ai-risk/${dismissTarget.student_id}/dismiss`, {
      method: "POST",
      body: JSON.stringify({
        reason: dismissReason,
        notes: dismissNotes,
      }),
    });
    setToast(
      `Marked ${dismissTarget.student_name} (${dismissTarget.student_id}) as False Flag at score ${dismissTarget.risk_score}/100. Will only resurface if score rises to ${
        dismissTarget.risk_score + 15
      }+.`
    );
    setDismissTarget(null);
    await loadRiskQueue();
  };

  const handleConfirmCallComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callTarget) return;
    await apiFetch(
      `/accounts/ai-risk/${callTarget.student_id}/complete-call`,
      {
        method: "POST",
        body: JSON.stringify({ notes: callNotes }),
      }
    );
    setToast(`Logged completed counsellor call for ${callTarget.student_name}`);
    setCallTarget(null);
    await loadRiskQueue();
  };

  if (loading || !data) {
    return <div className="h-80 rounded-2xl bg-slate-200 animate-pulse" />;
  }

  const activeAlerts = data.assessments.filter((a) =>
    ["HIGH", "UNSURE_BORDERLINE", "RESURFACED_HIGH_RISK"].includes(a.risk_level)
  );
  const dismissedOrLow = data.assessments.filter(
    (a) =>
      !["HIGH", "UNSURE_BORDERLINE", "RESURFACED_HIGH_RISK"].includes(
        a.risk_level
      )
  );

  return (
    <div className="space-y-6">
      {/* Strict Policy Guardrail Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <div className="font-bold text-sm">
              AI Dropout-Risk Guardrail Policy (When It Is Wrong or Unsure)
            </div>
            <span className="text-slate-300">
              Flags are computed from missed instalments (max 40 pts), falling
              attendance below 85% (max 35 pts), and negative mock test trends
              (max 25 pts), rounded once at the end.{" "}
              <strong className="text-white">
                An AI flag ONLY creates an internal counsellor call task—it
                never blocks the portal or sends a fee message to parents.
              </strong>
            </span>
          </div>
        </div>
      </div>

      {toast && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {toast}
        </div>
      )}

      {/* Active Flagged Students Queue */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900">
          Active Counsellor Call Queue ({activeAlerts.length})
        </h3>

        {activeAlerts.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500">
            No active high-risk or borderline students in the queue.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeAlerts.map((item) => {
              const fb = item.factor_breakdown;
              const isUnsure = item.risk_level === "UNSURE_BORDERLINE";
              return (
                <div
                  key={item.student_id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-900">
                          {item.student_name}
                        </span>
                        <span className="font-mono text-xs text-slate-500">
                          ({item.student_id})
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.batch} • {item.centre}
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold ${
                          isUnsure
                            ? "bg-amber-100 text-amber-900"
                            : "bg-red-100 text-red-900"
                        }`}
                      >
                        {isUnsure ? (
                          <HelpCircle className="w-3.5 h-3.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        )}
                        {item.risk_level} • {item.risk_score}/100
                      </span>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Data Confidence: <strong>{item.confidence}</strong>
                      </div>
                    </div>
                  </div>

                  {/* 3-Factor Explainable Progress Bars */}
                  <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <div className="flex justify-between font-medium text-slate-700 mb-1">
                        <span>
                          1. Fee Friction ({item.days_overdue}d overdue)
                        </span>
                        <span className="font-mono font-bold">
                          {fb.fee_pts} / {fb.fee_max} pts
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-red-600 rounded-full"
                          style={{
                            width: `${(fb.fee_pts / fb.fee_max) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-medium text-slate-700 mb-1">
                        <span>
                          2. Attendance Decay ({item.attendance_pct}% vs 85%
                          norm)
                        </span>
                        <span className="font-mono font-bold">
                          {fb.att_pts} / {fb.att_max} pts
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{
                            width: `${(fb.att_pts / fb.att_max) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-medium text-slate-700 mb-1">
                        <span>
                          3. Mock Test Trend ({item.test_scores.join("% → ")}% |{" "}
                          {item.test_delta > 0
                            ? `+${item.test_delta}`
                            : item.test_delta}
                          %)
                        </span>
                        <span className="font-mono font-bold">
                          {fb.test_pts} / {fb.test_max} pts
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full"
                          style={{
                            width: `${(fb.test_pts / fb.test_max) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Diagnostic Brief & Bilingual Opener */}
                  <div className="text-xs space-y-2">
                    <p className="text-slate-700 leading-relaxed">
                      <strong>Diagnostic Brief:</strong>{" "}
                      {item.diagnostic_summary}
                    </p>
                    <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-slate-800">
                      <strong>Suggested Hindi Call Opener:</strong>{" "}
                      {item.hindi_call_opener}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setCallTarget(item)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      Log Counsellor Call Completed
                    </button>

                    <button
                      onClick={() => setDismissTarget(item)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                    >
                      <FlagOff className="w-3.5 h-3.5 text-red-600" />
                      Mark as False Flag (AI Wrong)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dismissed False Flags & Low-Risk Audit Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">
            Dismissed False Flags & Healthy Cohort Audit Log
          </h3>
          <p className="text-xs text-slate-500">
            Dismissed flags store the baseline score at dismissal and
            automatically resurface if the student's risk score jumps by 15+
            points.
          </p>
        </div>
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Student</th>
              <th className="py-3 px-4">Current Score</th>
              <th className="py-3 px-4">Risk Status</th>
              <th className="py-3 px-4">Counsellor Override / Resurfacing Rule</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dismissedOrLow.map((item) => (
              <tr key={item.student_id}>
                <td className="py-3 px-4 font-bold text-slate-900">
                  {item.student_name} ({item.student_id})
                </td>
                <td className="py-3 px-4 font-mono font-bold">
                  {item.risk_score} / 100
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      item.risk_level === "DISMISSED_FALSE_FLAG"
                        ? "bg-purple-100 text-purple-900"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {item.risk_level}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-600">
                  {item.dismissal_metadata.ai_dismissed ? (
                    <span>
                      Reason:{" "}
                      <strong>{item.dismissal_metadata.dismiss_reason}</strong>{" "}
                      ({item.dismissal_metadata.dismiss_notes}) • Dismissed at{" "}
                      {item.dismissal_metadata.dismissed_at_score}/100 (Resurfaces
                      at {(item.dismissal_metadata.dismissed_at_score || 0) + 15}
                      /100)
                    </span>
                  ) : (
                    <span>No intervention needed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mark as False Flag Modal */}
      {dismissTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Mark AI Flag as False Positive ({dismissTarget.student_name})
            </h3>
            <p className="text-xs text-slate-600">
              Current score is <strong>{dismissTarget.risk_score}/100</strong>.
              Dismissing suppresses this alert unless the student's score rises
              by 15+ points to{" "}
              <strong>{dismissTarget.risk_score + 15}/100</strong>.
            </p>
            <form onSubmit={handleConfirmDismiss} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Select Mandatory Dismissal Reason
                </label>
                <select
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-semibold bg-white"
                >
                  {data.valid_dismiss_reasons.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Counsellor Audit Note
                </label>
                <textarea
                  rows={3}
                  value={dismissNotes}
                  onChange={(e) => setDismissNotes(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 p-2.5"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDismissTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold"
                >
                  Confirm False Flag Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Counsellor Call Modal */}
      {callTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Log Counsellor Call Outcome ({callTarget.student_name})
            </h3>
            <form
              onSubmit={handleConfirmCallComplete}
              className="space-y-3 text-xs"
            >
              <textarea
                rows={3}
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 p-2.5"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCallTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-700 text-white font-semibold"
                >
                  Save Call Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
