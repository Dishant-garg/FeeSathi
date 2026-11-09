import React from "react";
import { useAuth } from "../context/AuthContext";

export const AccountsWorkspace: React.FC<{ refreshSignal: number }> = () => {
  const { user } = useAuth();
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">
          Staff Workspace: {user?.role} ({user?.name})
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Accounts central dashboard, Tally XML export, pro-rata refund calculator, and AI risk queue are loading...
        </p>
      </div>
    </div>
  );
};
