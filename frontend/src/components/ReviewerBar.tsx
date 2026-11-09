import React, { useState } from "react";
import { RotateCcw, Smartphone, Monitor, UserCheck, LogOut, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/client";

interface ReviewerBarProps {
  onDatabaseReset: () => void;
}

const DEMO_PERSONAS = [
  {
    initials: "IS",
    name: "Ishita",
    detail: "Part-Paid & 23d Overdue",
    phone: "9829010587",
    type: "mobile",
    accent: "text-rose-400 border-rose-500/30",
  },
  {
    initials: "MG",
    name: "Mohit",
    detail: "Due in 13d",
    phone: "9829010219",
    type: "mobile",
    accent: "text-amber-400 border-amber-500/30",
  },
  {
    initials: "AM",
    name: "Aarav",
    detail: "All Paid (Refund Demo)",
    phone: "9829010412",
    type: "mobile",
    accent: "text-emerald-400 border-emerald-500/30",
  },
  {
    initials: "DR",
    name: "Devansh",
    detail: "79d Overdue (>60d)",
    phone: "9829010641",
    type: "mobile",
    accent: "text-red-400 border-red-500/30",
  },
  {
    initials: "AC",
    name: "Accounts Exec",
    detail: "All 4 Centres",
    phone: "9829000001",
    type: "desktop",
    accent: "text-sky-400 border-sky-500/30",
  },
  {
    initials: "CR",
    name: "Counsellor",
    detail: "AI Risk Queue",
    phone: "9829000002",
    type: "counsellor",
    accent: "text-purple-400 border-purple-500/30",
  },
];

export const ReviewerBar: React.FC<ReviewerBarProps> = ({ onDatabaseReset }) => {
  const { user, demoSwitchUser, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleQuickSwitch = async (phone: string) => {
    try {
      setBusy(true);
      await demoSwitchUser(phone);
    } catch (err: any) {
      setToast(err.message || "Switch failed");
    } finally {
      setBusy(false);
    }
  };

  const handleResetDb = async () => {
    try {
      setBusy(true);
      await apiFetch("/demo/reset", { method: "POST" });
      onDatabaseReset();
      setToast("Database restored to reference date: 2026-11-02");
      setTimeout(() => setToast(null), 3500);
    } catch (err: any) {
      setToast(err.message || "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside aria-label="Reviewer 1-Click Switcher" className="no-print sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md text-slate-100 border-b border-slate-800/80 px-4 py-2.5 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 mr-1 text-[11px] font-extrabold uppercase tracking-widest text-indigo-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span>Evaluator Dock</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {DEMO_PERSONAS.map((p) => {
              const active = user?.phone === p.phone;
              return (
                <button
                  key={p.phone}
                  disabled={busy}
                  onClick={() => handleQuickSwitch(p.phone)}
                  className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 border ${
                    active
                      ? "bg-indigo-600/25 border-indigo-500/80 text-white shadow-sm ring-1 ring-indigo-400/50"
                      : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850 hover:border-slate-700"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black tracking-tight border ${
                      active
                        ? "bg-indigo-500 text-white border-indigo-400"
                        : `bg-slate-800 ${p.accent}`
                    }`}
                  >
                    {p.initials}
                  </span>
                  <span>{p.name}</span>
                  <span className="text-[11px] opacity-70 font-normal hidden sm:inline">
                    • {p.detail}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {toast && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-lg animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {toast}
            </span>
          )}
          <button
            disabled={busy}
            onClick={handleResetDb}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 active:scale-95 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-semibold transition"
            title="Restore original seed data (Ishita 23d overdue, Mohit due in 13d, Aarav paid)"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${busy ? "animate-spin text-indigo-400" : ""}`} />
            <span>Reset Demo DB</span>
          </button>
          {user && (
            <button
              onClick={logout}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 transition"
              title="Sign out to test OTP Login & DPDP consent flow"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
