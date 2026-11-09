import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch, UserProfile } from "../api/client";
import { Lang } from "../i18n/translations";

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  lang: Lang;
  setLang: (l: Lang) => void;
  loginWithOtp: (
    phone: string,
    otp: string,
    dpdpConsent: boolean,
    preferredLang: Lang
  ) => Promise<void>;
  demoSwitchUser: (phone: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const token = localStorage.getItem("jaipur_jwt");
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<UserProfile>("/auth/me")
      .then((profile) => {
        setUser(profile);
        if (profile.preferred_lang === "hi" || profile.preferred_lang === "en") {
          setLang(profile.preferred_lang);
        }
      })
      .catch(() => {
        localStorage.removeItem("jaipur_jwt");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const loginWithOtp = async (
    phone: string,
    otp: string,
    dpdpConsent: boolean,
    preferredLang: Lang
  ) => {
    const res = await apiFetch<{ access_token: string; user: UserProfile }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          phone,
          otp,
          dpdp_consent: dpdpConsent,
          preferred_lang: preferredLang,
        }),
      }
    );
    localStorage.setItem("jaipur_jwt", res.access_token);
    setUser(res.user);
    setLang(res.user.preferred_lang || preferredLang);
  };

  const demoSwitchUser = async (phone: string) => {
    const res = await apiFetch<{ access_token: string; user: UserProfile }>(
      "/auth/demo-switch",
      {
        method: "POST",
        body: JSON.stringify({ phone }),
      }
    );
    localStorage.setItem("jaipur_jwt", res.access_token);
    setUser(res.user);
    setLang(res.user.preferred_lang || "en");
  };

  const logout = () => {
    localStorage.removeItem("jaipur_jwt");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        lang,
        setLang,
        loginWithOtp,
        demoSwitchUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
