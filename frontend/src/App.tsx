import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ReviewerBar } from "./components/ReviewerBar";
import { LoginPage } from "./pages/LoginPage";
import { ParentPortalPage } from "./pages/ParentPortalPage";
import { AccountsWorkspace } from "./pages/AccountsWorkspace";

const MainRouter: React.FC = () => {
  const { user, loading } = useAuth();
  const [refreshSignal, setRefreshSignal] = useState(0);

  const triggerRefresh = () => setRefreshSignal((prev) => prev + 1);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <ReviewerBar onDatabaseReset={triggerRefresh} />
      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500">
          Loading session...
        </div>
      ) : !user ? (
        <LoginPage />
      ) : user.role === "PARENT" ? (
        <ParentPortalPage refreshSignal={refreshSignal} />
      ) : (
        <AccountsWorkspace refreshSignal={refreshSignal} />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainRouter />
    </AuthProvider>
  );
}
