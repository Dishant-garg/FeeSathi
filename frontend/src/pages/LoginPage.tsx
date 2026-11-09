import React, { useState } from "react";
import {
  ShieldCheck,
  Lock,
  Globe,
  UserCheck,
  Building2,
  Sparkles,
  ArrowRight,
  GraduationCap,
  Briefcase,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  Clock,
  HeartHandshake,
  Landmark,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { tDict } from "../i18n/translations";

type LoginTab = "PARENT" | "STAFF" | "EVALUATOR";

interface EvaluatorPersona {
  phone: string;
  name: string;
  role: string;
  badge: string;
  badgeColor: string;
  description: string;
  details: string;
  icon: React.ReactNode;
}

const EVALUATOR_PERSONAS: EvaluatorPersona[] = [
  {
    phone: "9829010587",
    name: "Ishita Sharma (Parent)",
    role: "Parent Portal",
    badge: "23d Overdue",
    badgeColor: "bg-rose-100 text-rose-700 border-rose-200",
    description: "Class 11 JEE • Tonk Road Centre",
    details: "Instalment #2 ₹15,000 pending. Test partial payment, UPI QR, & WhatsApp reminder logs.",
    icon: <Clock className="w-4 h-4 text-rose-600" />,
  },
  {
    phone: "9829010219",
    name: "Mohit Goyal (Parent)",
    role: "Parent Portal",
    badge: "Due in 13d",
    badgeColor: "bg-amber-100 text-amber-700 border-amber-200",
    description: "Class 12 NEET • Vaishali Nagar Centre",
    details: "Instalment #3 due soon. Test proactive discount prompt and pay before due date.",
    icon: <Sparkles className="w-4 h-4 text-amber-600" />,
  },
  {
    phone: "9829010412",
    name: "Aarav Meena (Parent)",
    role: "Parent Portal",
    badge: "All Paid (100%)",
    badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
    description: "Class 11 Foundation • Malviya Nagar",
    details: "All ₹1,40,000 paid. Perfect for testing course withdrawal and Pro-Rata Refund Calculator.",
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  },
  {
    phone: "9829010641",
    name: "Devansh Rathore (Parent)",
    role: "Parent Portal",
    badge: "79d Overdue (>60d)",
    badgeColor: "bg-red-100 text-red-700 border-red-200",
    description: "Class 12 JEE • Mansarovar Centre",
    details: "High overdue case. Test severe default warning, reminder kill-switch, & outreach notes.",
    icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
  },
  {
    phone: "9829000001",
    name: "Accounts Executive",
    role: "Finance Desk",
    badge: "4 Centres Treasury",
    badgeColor: "bg-sky-100 text-sky-700 border-sky-200",
    description: "All Centres • Financial Operations",
    details: "Central Dues Dashboard, branch cash flows, fee ledgers, and pro-rata refund approvals.",
    icon: <Landmark className="w-4 h-4 text-sky-600" />,
  },
  {
    phone: "9829000002",
    name: "Academic Counsellor",
    role: "Pastoral Desk",
    badge: "AI Risk Desk",
    badgeColor: "bg-purple-100 text-purple-700 border-purple-200",
    description: "Jaipur Central • Mentorship Queue",
    details: "AI Dropout Risk scoring, sentiment analysis, diagnostic calls, and pause reminder kill-switch.",
    icon: <HeartHandshake className="w-4 h-4 text-purple-600" />,
  },
];

export const LoginPage: React.FC = () => {
  const { loginWithOtp, demoSwitchUser, lang, setLang } = useAuth();
  const t = tDict[lang];

  const [activeTab, setActiveTab] = useState<LoginTab>("PARENT");
  const [phone, setPhone] = useState("9829010587");
  const [otp, setOtp] = useState("123456");
  const [dpdpConsent, setDpdpConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle staff preset selection
  const handleSelectStaffRole = (staffPhone: string) => {
    setPhone(staffPhone);
    setOtp("123456");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (activeTab === "PARENT" && !dpdpConsent) {
      setError(
        "DPDP Act 2023 verifiable parental consent is mandatory to access minor student educational and fee records."
      );
      return;
    }
    try {
      setSubmitting(true);
      await loginWithOtp(phone.trim(), otp.trim(), dpdpConsent, lang);
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please verify credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInstantEvaluatorLogin = async (evaluatorPhone: string) => {
    setError(null);
    try {
      setSubmitting(true);
      await demoSwitchUser(evaluatorPhone);
    } catch (err: any) {
      setError(err.message || "Quick switch failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Header / Brand Bar */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-extrabold tracking-tight text-base sm:text-lg">
                Sankalp Coaching
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 border border-indigo-400/30 px-2 py-0.5 rounded-full">
                Jaipur
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              FeeSathi • AI Fee Intelligence & DPDP-Compliant Engagement
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setLang(lang === "en" ? "hi" : "en")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition"
        >
          <Globe className="w-3.5 h-3.5 text-indigo-400" />
          <span>{lang === "en" ? "हिंदी संस्करण" : "English View"}</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl w-full mx-auto my-auto py-8">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
          
          {/* Tab Selector: Parent vs Staff vs Evaluator */}
          <div className="bg-slate-50 border-b border-slate-200 p-2 sm:p-3 flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("PARENT");
                setPhone("9829010587");
                setOtp("123456");
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === "PARENT"
                  ? "bg-white text-indigo-900 shadow-sm border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
              }`}
            >
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              <span>Parent Portal</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("STAFF");
                setPhone("9829000001");
                setOtp("123456");
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === "STAFF"
                  ? "bg-white text-indigo-900 shadow-sm border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
              }`}
            >
              <Briefcase className="w-4 h-4 text-sky-600" />
              <span>Staff Portal</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("EVALUATOR");
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === "EVALUATOR"
                  ? "bg-gradient-to-r from-indigo-900 to-purple-900 text-white shadow-md shadow-indigo-950/20"
                  : "text-purple-700 bg-purple-50/70 hover:bg-purple-100/70 border border-purple-200/60"
              }`}
            >
              <FlaskConical className="w-4 h-4 text-purple-400" />
              <span>Evaluator Sandbox</span>
              <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[10px] bg-purple-400/20 text-purple-200 uppercase font-black">
                Demo
              </span>
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {/* VIEW 1: PARENT PORTAL LOGIN */}
            {activeTab === "PARENT" && (
              <div className="max-w-md mx-auto space-y-6">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    {t.loginHeading}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Enter your registered 10-digit mobile number to receive a secure OTP.
                  </p>
                </div>

                {/* Quick Pre-fill Chips for Parent Personas */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>Quick Autofill for Demo Parents:</span>
                    <span className="text-indigo-600 font-medium">Click to populate</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPhone("9829010587")}
                      className={`text-left px-2.5 py-1.5 rounded-xl border text-xs transition ${
                        phone === "9829010587"
                          ? "bg-indigo-600 text-white border-indigo-600 font-semibold shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="font-semibold">Ishita Sharma</div>
                      <div className="text-[10px] opacity-80">23d Overdue • ₹15k</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPhone("9829010219")}
                      className={`text-left px-2.5 py-1.5 rounded-xl border text-xs transition ${
                        phone === "9829010219"
                          ? "bg-indigo-600 text-white border-indigo-600 font-semibold shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="font-semibold">Mohit Goyal</div>
                      <div className="text-[10px] opacity-80">Due in 13d • Discount</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPhone("9829010412")}
                      className={`text-left px-2.5 py-1.5 rounded-xl border text-xs transition ${
                        phone === "9829010412"
                          ? "bg-indigo-600 text-white border-indigo-600 font-semibold shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="font-semibold">Aarav Meena</div>
                      <div className="text-[10px] opacity-80">All Paid • Refund Demo</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPhone("9829010641")}
                      className={`text-left px-2.5 py-1.5 rounded-xl border text-xs transition ${
                        phone === "9829010641"
                          ? "bg-indigo-600 text-white border-indigo-600 font-semibold shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className="font-semibold">Devansh Rathore</div>
                      <div className="text-[10px] opacity-80">79d Overdue (&gt;60d)</div>
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.phoneLabel}
                    </label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 text-slate-600 text-sm font-semibold">
                        +91
                      </span>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="10-digit mobile number"
                        required
                        className="w-full rounded-r-xl border border-slate-300 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.otpLabel}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        required
                        maxLength={6}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm tracking-widest font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dpdpConsent}
                      onChange={(e) => setDpdpConsent(e.target.checked)}
                      className="mt-0.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-600"
                    />
                    <span className="text-xs text-indigo-950 leading-relaxed font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 inline text-emerald-600 mr-1" />
                      {t.dpdpConsentLabel}
                    </span>
                  </label>

                  {error && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 disabled:opacity-50 text-white font-bold text-sm transition shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      t.signingIn
                    ) : (
                      <>
                        <span>{t.signInBtn}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* VIEW 2: STAFF PORTAL LOGIN */}
            {activeTab === "STAFF" && (
              <div className="max-w-md mx-auto space-y-6">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Institute Staff & Counsellor Login
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Restricted to authorized administrative, treasury, and academic mentorship staff.
                  </p>
                </div>

                {/* Staff Role Selector */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSelectStaffRole("9829000001")}
                    className={`p-3.5 rounded-2xl border text-left transition ${
                      phone === "9829000001"
                        ? "bg-sky-50 border-sky-400 ring-2 ring-sky-300"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center mb-2 shadow-sm">
                      <Landmark className="w-4 h-4" />
                    </div>
                    <div className="font-bold text-xs text-slate-900">Accounts Executive</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Central Treasury & Refunds</div>
                    <div className="mt-2 text-[10px] font-mono text-sky-700 font-semibold">9829000001</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectStaffRole("9829000002")}
                    className={`p-3.5 rounded-2xl border text-left transition ${
                      phone === "9829000002"
                        ? "bg-purple-50 border-purple-400 ring-2 ring-purple-300"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-2 shadow-sm">
                      <HeartHandshake className="w-4 h-4" />
                    </div>
                    <div className="font-bold text-xs text-slate-900">Academic Counsellor</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">AI Dropout Risk Desk</div>
                    <div className="mt-2 text-[10px] font-mono text-purple-700 font-semibold">9829000002</div>
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Staff Registered Mobile
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Verification OTP
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        required
                        maxLength={6}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm tracking-widest font-mono font-bold focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-98 disabled:opacity-50 text-white font-bold text-sm transition shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      "Verifying..."
                    ) : (
                      <>
                        <span>Sign In to Staff Workspace</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* VIEW 3: HACKATHON EVALUATOR / JUDGE SANDBOX */}
            {activeTab === "EVALUATOR" && (
              <div className="space-y-6">
                <div className="border-b border-slate-200 pb-4">
                  <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-purple-700 bg-purple-100 px-3 py-1 rounded-full mb-2">
                    <FlaskConical className="w-3.5 h-3.5" />
                    Hackathon Evaluation & Judge Sandbox
                  </div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Instant 1-Click Persona Simulator
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Evaluators can jump directly into any of the 6 test scenarios with seed data pre-configured for instant review.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {EVALUATOR_PERSONAS.map((p) => (
                    <div
                      key={p.phone}
                      className="border border-slate-200/90 rounded-2xl p-4 bg-slate-50/50 hover:bg-white hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {p.role}
                            </span>
                            <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition">
                              {p.name}
                            </h3>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${p.badgeColor}`}
                          >
                            {p.icon}
                            {p.badge}
                          </span>
                        </div>

                        <p className="text-[11px] font-medium text-slate-500">
                          {p.description}
                        </p>
                        <p className="text-xs text-slate-600 leading-relaxed bg-white/80 p-2.5 rounded-xl border border-slate-100">
                          {p.details}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                        <span className="text-[11px] font-mono font-medium text-slate-500">
                          Phone: {p.phone}
                        </span>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleInstantEvaluatorLogin(p.phone)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold transition shadow-xs"
                        >
                          <span>Launch Session</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Footer Note */}
          <div className="bg-slate-50 border-t border-slate-200/80 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Verifiable Parental Consent & DPDP Act 2023 Compliant</span>
            </div>
            <div>
              <span>Support Desk: 1800-SANKALP • Jaipur, Rajasthan</span>
            </div>
          </div>
        </div>
      </main>

      {/* Page Footer */}
      <footer className="text-center py-2 text-[11px] text-slate-400">
        © 2026 Sankalp Coaching Institute, Jaipur • FeeSathi Architecture Demonstration
      </footer>
    </div>
  );
};
