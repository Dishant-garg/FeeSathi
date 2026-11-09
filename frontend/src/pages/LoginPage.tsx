import React, { useState } from "react";
import { ShieldCheck, Lock, Globe } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { tDict } from "../i18n/translations";

export const LoginPage: React.FC = () => {
  const { loginWithOtp, lang, setLang } = useAuth();
  const t = tDict[lang];

  const [phone, setPhone] = useState("9829010587");
  const [otp, setOtp] = useState("123456");
  const [dpdpConsent, setDpdpConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isParentPhone =
    phone !== "9829000001" && phone !== "9829000002";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isParentPhone && !dpdpConsent) {
      setError(
        "DPDP Act 2023 verifiable parental consent is required for minor student accounts."
      );
      return;
    }
    try {
      setSubmitting(true);
      await loginWithOtp(phone.trim(), otp.trim(), dpdpConsent, lang);
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-44px)] flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="flex items-start justify-between gap-2 mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {t.instituteTitle}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.instituteSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "hi" : "en")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === "en" ? "हिंदी / EN" : "EN / हिंदी"}
          </button>
        </div>

        <h2 className="text-base font-semibold text-slate-800 mb-4">
          {t.loginHeading}
        </h2>

        {/* Quick Preset Selector inside Login Card */}
        <div className="mb-5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div className="font-medium text-slate-600 mb-2">
            Select Registered Demo Phone:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setPhone("9829010587")}
              className={`text-left px-2.5 py-1.5 rounded-lg border transition ${
                phone === "9829010587"
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div className="font-semibold font-mono text-xs">9829010587</div>
              <div className="text-[10px] opacity-80">Ishita (23d Overdue)</div>
            </button>
            <button
              type="button"
              onClick={() => setPhone("9829010219")}
              className={`text-left px-2.5 py-1.5 rounded-lg border transition ${
                phone === "9829010219"
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div className="font-semibold font-mono text-xs">9829010219</div>
              <div className="text-[10px] opacity-80">Mohit (Due in 13d)</div>
            </button>
            <button
              type="button"
              onClick={() => setPhone("9829010412")}
              className={`text-left px-2.5 py-1.5 rounded-lg border transition ${
                phone === "9829010412"
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div className="font-semibold font-mono text-xs">9829010412</div>
              <div className="text-[10px] opacity-80">Aarav (All Paid)</div>
            </button>
            <button
              type="button"
              onClick={() => setPhone("9829010641")}
              className={`text-left px-2.5 py-1.5 rounded-lg border transition ${
                phone === "9829010641"
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div className="font-semibold font-mono text-xs">9829010641</div>
              <div className="text-[10px] opacity-80">Devansh (79d Late)</div>
            </button>
            <button
              type="button"
              onClick={() => setPhone("9829000001")}
              className={`text-left px-2.5 py-1.5 rounded-lg border transition ${
                phone === "9829000001"
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div className="font-semibold font-mono text-xs">9829000001</div>
              <div className="text-[10px] opacity-80">Accounts Staff</div>
            </button>
            <button
              type="button"
              onClick={() => setPhone("9829000002")}
              className={`text-left px-2.5 py-1.5 rounded-lg border transition ${
                phone === "9829000002"
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div className="font-semibold font-mono text-xs">9829000002</div>
              <div className="text-[10px] opacity-80">Counsellor (AI)</div>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {t.phoneLabel}
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {t.otpLabel}
            </label>
            <div className="relative">
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                maxLength={6}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>
          </div>

          {isParentPhone && (
            <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={dpdpConsent}
                onChange={(e) => setDpdpConsent(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span className="text-xs text-slate-600 leading-relaxed">
                <ShieldCheck className="w-3.5 h-3.5 inline text-emerald-600 mr-1" />
                {t.dpdpConsentLabel}
              </span>
            </label>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-sm transition shadow-sm"
          >
            {submitting ? t.signingIn : t.signInBtn}
          </button>
        </form>
      </div>
    </div>
  );
};
