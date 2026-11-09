import React, { useState } from "react";
import {
  LayoutDashboard,
  FileSpreadsheet,
  BellRing,
  Calculator,
  BrainCircuit,
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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(
    user?.role === "COUNSELLOR" ? "AI_RISK" : "DASHBOARD"
  );
  const [selectedStudentId, setSelectedStudentId] =
    useState<string>("STU-0587");

  const navItems: Array<{
    id: WorkspaceTab;
    label: string;
    icon: React.ReactNode;
  }> = [
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
      label: "5. AI Dropout-Risk Queue",
      icon: <BrainCircuit className="w-4 h-4" />,
    },
  ];

  return (
    <div className="max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
      {/* Workspace Header & Tab Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Sankalp Coaching Jaipur — Central Operations Portal
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-white">
              {user?.role}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Signed in as <strong>{user?.name}</strong> • 4 Centres (Tonk Road,
            Vaishali Nagar, Malviya Nagar, Mansarovar)
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-1.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === item.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Active Screen Content */}
      {activeTab === "DASHBOARD" && (
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

      {activeTab === "REFUNDS" && (
        <RefundCalculatorTab refreshSignal={refreshSignal} />
      )}

      {activeTab === "AI_RISK" && (
        <AiRiskQueueTab refreshSignal={refreshSignal} />
      )}
    </div>
  );
};
