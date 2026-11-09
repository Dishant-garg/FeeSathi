import React, { useEffect, useState, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ReviewerBar } from "./components/ReviewerBar";
import { LoginPage } from "./pages/LoginPage";
import { ParentPortalPage } from "./pages/ParentPortalPage";
import { AccountsWorkspace } from "./pages/AccountsWorkspace";

const MainRouter: React.FC = () => {
  const { user, loading } = useAuth();
  const [refreshSignal, setRefreshSignal] = useState(0);

  // Track user identity — when the user object changes (demo switch, login, logout),
  // bump refreshSignal so all child pages re-fetch data with the new JWT.
  const prevUserRef = useRef<string | null>(null);
  useEffect(() => {
    const currentKey = user ? `${user.id}-${user.phone}` : null;
    if (prevUserRef.current !== null && currentKey !== prevUserRef.current) {
      // User changed — force all data-fetching pages to reload
      setRefreshSignal((prev) => prev + 1);
    }
    prevUserRef.current = currentKey;
  }, [user]);

  const triggerRefresh = () => setRefreshSignal((prev) => prev + 1);

  return (
    <div className="min-h-screen flex flex-col">
      <ReviewerBar onDatabaseReset={triggerRefresh} />
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-500 font-medium">Loading session...</span>
          </div>
        </div>
      ) : !user ? (
        <LoginPage />
      ) : user.role === "PARENT" ? (
        // Key by user.id forces React to fully unmount + remount on persona switch,
        // guaranteeing a clean slate with no stale data from the previous parent.
        <ParentPortalPage key={user.id} refreshSignal={refreshSignal} />
      ) : (
        <AccountsWorkspace key={user.id} refreshSignal={refreshSignal} />
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

