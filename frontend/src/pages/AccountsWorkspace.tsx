import React, { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FileSpreadsheet,
  BellRing,
  Calculator,
  BrainCircuit,
  HeartHandshake,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { DashboardTab } from "../components/accounts/DashboardTab";
import { LedgerAndRemindersTab } from "../components/accounts/LedgerAndRemindersTab";
import { RefundCalculatorTab } from "../components/accounts/RefundCalculatorTab";
import { AiRiskQueueTab } from "../components/accounts/AiRiskQueueTab";

interface AccountsWorkspaceProps {
  refreshSignal: number;
}

type WorkspaceTab =
  | "DASHBOARD"
  | "LEDGER"
  | "REMINDERS"
  | "REFUNDS"
  | "AI_RISK";

export const AccountsWorkspace: React.FC<AccountsWorkspaceProps> = ({
  refreshSignal,
}) => {
  const { user } = useAuth();
  const isCounsellor = user?.role === "COUNSELLOR";

  const [activeTab, setActiveTab] = useState<WorkspaceTab>(
    isCounsellor ? "AI_RISK" : "DASHBOARD"
  );
  const [selectedStudentId, setSelectedStudentId] =
    useState<string>("STU-0587");

  // Automatically switch default view when toggling between Accounts and Counsellor roles
  useEffect(() => {
    if (user?.role === "COUNSELLOR") {
      setActiveTab("AI_RISK");
    } else {
      setActiveTab("DASHBOARD");
    }
  }, [user?.role]);

  // Role-specific navigation items: Counsellors focus on student welfare; Accounts focuses on treasury
  const navItems: Array<{
    id: WorkspaceTab;
    label: string;
    icon: React.ReactNode;
  }> = isCounsellor
    ? [
        {
          id: "AI_RISK",
          label: "1. AI Dropout-Risk Queue",
          icon: <BrainCircuit className="w-4 h-4" />,
        },
        {
          id: "LEDGER",
          label: "2. Student Academic Ledger",
          icon: <FileSpreadsheet className="w-4 h-4" />,
        },
        {
          id: "REMINDERS",
          label: "3. Reminder Kill-Switch Audit",
          icon: <BellRing className="w-4 h-4" />,
        },
      ]
    : [
        {
          id: "DASHBOARD",
          label: "1. Central Dues Dashboard",
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
        {
          id: "LEDGER",
          label: "2. Student Fee Ledger",
          icon: <FileSpreadsheet className="w-4 h-4" />,
        },
        {
          id: "REMINDERS",
          label: "3. Reminder Kill-Switch Log",
          icon: <BellRing className="w-4 h-4" />,
        },
        {
          id: "REFUNDS",
          label: "4. Pro-Rata Refund Calculator",
          icon: <Calculator className="w-4 h-4" />,
        },
        {
          id: "AI_RISK",
          label: "5. AI Risk Overview",
          icon: <BrainCircuit className="w-4 h-4" />,
        },
      ];

  return (
    <div className="max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
      {/* Role-Differentiated Workspace Header & Tab Bar */}
      <div
        className={`rounded-3xl border p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all duration-300 ${
          isCounsellor
            ? "bg-gradient-to-r from-purple-950/5 via-white to-indigo-950/5 border-purple-200/80 shadow-purple-500/5"
            : "bg-gradient-to-r from-slate-900/5 via-white to-emerald-950/5 border-slate-200/90 shadow-slate-900/5"
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md ${
              isCounsellor
                ? "bg-gradient-to-br from-purple-600 via-indigo-600 to-indigo-800 shadow-purple-500/25"
                : "bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-800 shadow-slate-900/25"
            }`}
          >
            {isCounsellor ? (
              <HeartHandshake className="w-6 h-6" />
            ) : (
              <Landmark className="w-6 h-6" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight">
                {isCounsellor
                  ? "Sankalp Coaching Jaipur — Academic Mentorship & Welfare Portal"
                  : "Sankalp Coaching Jaipur — Financial & Treasury Operations"}
              </h1>
              <span
                className={`px-3 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
                  isCounsellor
                    ? "bg-purple-100 text-purple-900 border border-purple-200"
                    : "bg-emerald-100 text-emerald-900 border border-emerald-200"
                }`}
              >
                {user?.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span>Signed in as <strong className="text-slate-800">{user?.name}</strong></span>
              <span>•</span>
              <span>
                {isCounsellor
                  ? "Pastoral Care, Dropout Intervention & Diagnostic Call Desk"
                  : "4 Jaipur Centres (Tonk Road, Vaishali Nagar, Malviya Nagar, Mansarovar)"}
              </span>
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                  active
                    ? isCounsellor
                      ? "bg-purple-900 text-white shadow-md shadow-purple-950/20"
                      : "bg-slate-900 text-white shadow-md shadow-slate-950/20"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Active Screen Content */}
      {activeTab === "DASHBOARD" && !isCounsellor && (
        <DashboardTab
          refreshSignal={refreshSignal}
          onSelectStudent={(studentId) => {
            setSelectedStudentId(studentId);
            setActiveTab("LEDGER");
          }}
        />
      )}

      {(activeTab === "LEDGER" || activeTab === "REMINDERS") && (
        <LedgerAndRemindersTab
          selectedStudentId={selectedStudentId}
          onSelectStudentId={setSelectedStudentId}
          refreshSignal={refreshSignal}
          subView={activeTab}
        />
      )}

      {activeTab === "REFUNDS" && !isCounsellor && (
        <RefundCalculatorTab refreshSignal={refreshSignal} />
      )}

      {activeTab === "AI_RISK" && (
        <AiRiskQueueTab refreshSignal={refreshSignal} />
      )}
    </div>
  );
};
