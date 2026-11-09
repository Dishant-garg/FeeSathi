import React, { useState } from "react";
import {
  RotateCcw,
  FlaskConical,
  X,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Sparkles,
  LogOut,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/client";

interface ReviewerBarProps {
  onDatabaseReset: () => void;
}

const DEMO_PERSONAS = [
  {
    initials: "IS",
    name: "Ishita",
    detail: "Part-Paid (23d Overdue)",
    phone: "9829010587",
    category: "Parent",
    badge: "23d Overdue",
    accent: "text-rose-400 border-rose-500/30",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  },
  {
    initials: "MG",
    name: "Mohit",
    detail: "Due in 13d (Discount)",
    phone: "9829010219",
    category: "Parent",
    badge: "Due in 13d",
    accent: "text-amber-400 border-amber-500/30",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
  {
    initials: "AM",
    name: "Aarav",
    detail: "All Paid (Refund Demo)",
    phone: "9829010412",
    category: "Parent",
    badge: "100% Paid",
    accent: "text-emerald-400 border-emerald-500/30",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  {
    initials: "DR",
    name: "Devansh",
    detail: "79d Overdue (>60d Rule)",
    phone: "9829010641",
    category: "Parent",
    badge: "79d Overdue",
    accent: "text-red-400 border-red-500/30",
    badgeColor: "bg-red-500/20 text-red-300 border-red-500/30",
  },
  {
    initials: "AC",
    name: "Accounts Exec",
    detail: "Treasury (4 Centres)",
    phone: "9829000001",
    category: "Staff",
    badge: "Finance Desk",
    accent: "text-sky-400 border-sky-500/30",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  },
  {
    initials: "CR",
    name: "Counsellor",
    detail: "AI Risk Queue Desk",
    phone: "9829000002",
    category: "Staff",
    badge: "AI Welfare Desk",
    accent: "text-purple-400 border-purple-500/30",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  },
];

export const ReviewerBar: React.FC<ReviewerBarProps> = ({ onDatabaseReset }) => {
  const { user, demoSwitchUser, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const activePersona = DEMO_PERSONAS.find((p) => p.phone === user?.phone);

  const handleQuickSwitch = async (phone: string) => {
    try {
      setBusy(true);
      await demoSwitchUser(phone);
    } catch (err: any) {
      setToast(err.message || "Switch failed");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setBusy(false);
    }
  };

  const handleResetDb = async () => {
    try {
      setBusy(true);
      await apiFetch("/demo/reset", { method: "POST" });
      onDatabaseReset();
      setToast("Database reset to Nov 2, 2026 seed state");
      setTimeout(() => setToast(null), 3500);
    } catch (err: any) {
      setToast(err.message || "Reset failed");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside
      aria-label="Evaluator Sandbox Dock"
      className="fixed bottom-5 right-5 z-50 no-print flex flex-col items-end gap-2"
    >
      {/* Toast Notification */}
      {toast && (
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-slate-900/95 border border-emerald-500/50 px-3.5 py-2 rounded-2xl shadow-xl backdrop-blur-md animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* EXPANDED PANEL */}
      {isOpen ? (
        <div className="w-[92vw] sm:w-[540px] max-w-full bg-slate-950/95 backdrop-blur-xl border border-slate-800 text-slate-100 rounded-3xl shadow-2xl p-4 sm:p-5 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
              </span>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-widest text-indigo-400 flex items-center gap-1.5">
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>Evaluator Sandbox Switcher</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Switch personas instantly to verify student cases & staff workflows
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
                title="Collapse Sandbox Dock"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Persona Grid (6 Personas) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DEMO_PERSONAS.map((p) => {
              const active = user?.phone === p.phone;
              return (
                <button
                  key={p.phone}
                  type="button"
                  disabled={busy}
                  onClick={() => handleQuickSwitch(p.phone)}
                  className={`text-left p-2.5 rounded-2xl border transition-all duration-150 flex flex-col justify-between ${
                    active
                      ? "bg-indigo-600/30 border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-400/50"
                      : "bg-slate-900/80 border-slate-800/90 text-slate-300 hover:bg-slate-850 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black border ${
                        active
                          ? "bg-indigo-500 text-white border-indigo-400"
                          : `bg-slate-800 ${p.accent}`
                      }`}
                    >
                      {p.initials}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${p.badgeColor}`}
                    >
                      {p.badge}
                    </span>
                  </div>

                  <div>
                    <div className="text-xs font-bold truncate text-slate-100">
                      {p.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {p.detail}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer Controls: Reset DB & Sign Out */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              disabled={busy}
              onClick={handleResetDb}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 active:scale-95 text-slate-300 hover:text-white border border-slate-800 font-semibold transition"
              title="Restore original seed data: 2026-11-02"
            >
              <RotateCcw
                className={`w-3.5 h-3.5 ${busy ? "animate-spin text-indigo-400" : ""}`}
              />
              <span>Reset Demo DB</span>
            </button>

            {user && (
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 hover:text-rose-200 font-semibold transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* COLLAPSED FLOATING PILL */
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-slate-950/95 hover:bg-slate-900 active:scale-95 text-slate-200 border border-slate-800 hover:border-indigo-500/50 shadow-2xl backdrop-blur-md transition-all duration-200"
          title="Open Evaluator Switcher"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
          </span>

          <FlaskConical className="w-4 h-4 text-indigo-400" />

          <div className="text-xs font-bold flex items-center gap-1.5">
            <span className="hidden sm:inline text-slate-400">Sandbox:</span>
            <span className="text-white font-extrabold">
              {activePersona ? activePersona.name : "Evaluator Mode"}
            </span>
          </div>

          <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-white transition" />
        </button>
      )}
    </aside>
  );
};
