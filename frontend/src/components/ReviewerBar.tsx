import React, { useState } from "react";
import { RotateCcw, Smartphone, Monitor, UserCheck, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/client";

interface ReviewerBarProps {
  onDatabaseReset: () => void;
}

const DEMO_PERSONAS = [
  {
    label: "Ishita's Parent (Part-Paid & 23d Overdue)",
    phone: "9829010587",
    type: "mobile",
  },
  {
    label: "Mohit's Parent (Due in 13d)",
    phone: "9829010219",
    type: "mobile",
  },
  {
    label: "Aarav's Parent (All Paid)",
    phone: "9829010412",
    type: "mobile",
  },
  {
    label: "Accounts Executive (All 4 Centres)",
    phone: "9829000001",
    type: "desktop",
  },
  {
    label: "Academic Counsellor (AI Flags)",
    phone: "9829000002",
    type: "counsellor",
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
      setToast("Demo database restored to initial seed state (2026-11-02)");
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast(err.message || "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="no-print bg-slate-900 text-slate-100 border-b border-slate-800 px-3 py-2 text-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-amber-400 uppercase tracking-wider mr-1">
            Reviewer 1-Click Switch:
          </span>
          {DEMO_PERSONAS.map((p) => {
            const active = user?.phone === p.phone;
            return (
              <button
                key={p.phone}
                disabled={busy}
                onClick={() => handleQuickSwitch(p.phone)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-medium transition ${
                  active
                    ? "bg-white text-slate-900 shadow-sm"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {p.type === "mobile" ? (
                  <Smartphone className="w-3 h-3" />
                ) : p.type === "desktop" ? (
                  <Monitor className="w-3 h-3" />
                ) : (
                  <UserCheck className="w-3 h-3" />
                )}
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {toast && (
            <span className="text-emerald-400 font-medium">{toast}</span>
          )}
          <button
            disabled={busy}
            onClick={handleResetDb}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Restore original seed data (Ishita 23d overdue, Mohit due in 13d, Aarav paid)"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Demo DB
          </button>
          {user && (
            <button
              onClick={logout}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-slate-400 hover:text-white"
              title="Sign out to test OTP Login & DPDP consent flow"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
