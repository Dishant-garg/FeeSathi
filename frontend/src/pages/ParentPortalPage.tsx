import React, { useEffect, useState } from "react";
import {
  Globe,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  BellOff,
  ShieldCheck,
  CreditCard,
  Building2,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import {
  apiFetch,
  formatInr,
  GstInvoice,
  InstalmentItem,
  ParentPortalPayload,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import { tDict } from "../i18n/translations";
import { PaymentModal } from "../components/PaymentModal";
import { GstReceiptModal } from "../components/GstReceiptModal";

interface ParentPortalPageProps {
  refreshSignal: number;
}

export const ParentPortalPage: React.FC<ParentPortalPageProps> = ({
  refreshSignal,
}) => {
  const { lang, setLang } = useAuth();
  const t = tDict[lang];

  const [data, setData] = useState<ParentPortalPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"FEES" | "ACADEMIC">("FEES");

  const [payingInstalment, setPayingInstalment] =
    useState<InstalmentItem | null>(null);
  const [activeInvoice, setActiveInvoice] = useState<GstInvoice | null>(null);

  const loadPortal = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<ParentPortalPayload>("/parent/portal");
      setData(res);
    } catch (err: any) {
      setError(err.message || "Could not load portal");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortal();
  }, [refreshSignal]);

  const handleOpenReceipt = async (receiptNo: string) => {
    try {
      const inv = await apiFetch<GstInvoice>(`/receipts/${receiptNo}`);
      setActiveInvoice(inv);
    } catch (err: any) {
      alert(err.message || "Could not load GST receipt");
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="h-20 rounded-2xl bg-slate-200/80 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <div className="h-64 rounded-3xl bg-slate-200/80 animate-pulse" />
            <div className="h-80 rounded-3xl bg-slate-200/80 animate-pulse" />
          </div>
          <div className="lg:col-span-5 space-y-6">
            <div className="h-52 rounded-3xl bg-slate-200/80 animate-pulse" />
            <div className="h-72 rounded-3xl bg-slate-200/80 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="p-6 rounded-3xl bg-red-50 border border-red-200 text-center space-y-3 shadow-sm">
          <AlertCircle className="w-10 h-10 text-red-600 mx-auto" />
          <h2 className="text-base font-bold text-red-900">Portal Temporarily Unavailable</h2>
          <p className="text-xs text-red-700">{error || "Please refresh or contact admissions support."}</p>
          <button
            onClick={loadPortal}
            className="px-4 py-2 rounded-xl bg-red-700 text-white text-xs font-semibold hover:bg-red-800 transition"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const { student, hero_due_card: hero } = data;
  const hasDueNow = hero && hero.remaining_balance > 0 && student.status !== "WITHDRAWN";

  // Calculate cumulative fee payment percentage
  const paidPercent =
    student.net_annual_fee > 0
      ? Math.min(100, Math.round((student.total_paid / student.net_annual_fee) * 100))
      : 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Top Header Card */}
        <header className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 px-5 py-4 flex flex-wrap items-center justify-between gap-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                  {t.instituteTitle}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3" />
                  DPDP 2023 Verified
                </span>
              </div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
                {student.name}{" "}
                <span className="text-xs font-mono font-normal text-slate-500">
                  ({student.id})
                </span>
              </h1>
              <div className="text-xs text-slate-500">
                {student.batch} • {student.centre} Centre
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === "en" ? "hi" : "en")}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 transition active:scale-95 shadow-2xs"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span>{lang === "en" ? "हिंदी संस्करण" : "English View"}</span>
            </button>
          </div>
        </header>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left Column: Dues Hero + Payment Stepper (7 cols) */}
          <div className="lg:col-span-7 space-y-6">

            {/* THE 5-SECOND RULE HERO CARD */}
            <section className="relative overflow-hidden bg-gradient-to-br from-white via-slate-50/70 to-indigo-50/40 rounded-3xl border border-slate-200/90 p-6 shadow-xl shadow-indigo-950/5 transition hover:border-indigo-200">
              {/* Subtle Ambient Radial Highlight */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

              {hasDueNow && hero ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {t.amountDueNow} ({t.instalmentWord} #{hero.instalment_no})
                    </span>

                    {hero.days_overdue > 0 ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-100/90 text-rose-800 border border-rose-200 shadow-2xs">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                        </span>
                        {hero.days_overdue} {t.daysOverdue}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100/90 text-amber-900 border border-amber-200">
                        <Clock className="w-3.5 h-3.5 text-amber-700" />
                        {t.dueInDays} {hero.days_until_due} {t.daysWord}
                      </span>
                    )}
                  </div>

                  {/* Big Hero Amount */}
                  <div className="flex items-baseline gap-3 my-1">
                    <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight font-sans">
                      {formatInr(hero.remaining_balance)}
                    </span>
                    {hero.amount_paid > 0 && (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2.5 py-1 rounded-lg">
                        {t.partPaidBadge}: {formatInr(hero.amount_paid)} paid
                      </span>
                    )}
                  </div>

                  {/* Due Date & Fee Progress Bar */}
                  <div className="space-y-2 pt-1 border-t border-slate-200/60">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>
                        {t.dueDate}: <strong className="font-mono text-slate-900">{hero.due_date}</strong>
                      </span>
                      <span className="font-medium text-slate-700">
                        {paidPercent}% of Annual Fee Paid
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 rounded-full transition-all duration-500"
                        style={{ width: `${paidPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Instant Primary CTA */}
                  <div className="pt-2 space-y-2.5">
                    <button
                      onClick={() => setPayingInstalment(hero)}
                      className="group relative w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 hover:from-indigo-900 hover:to-slate-900 text-white font-extrabold text-base transition-all duration-200 shadow-xl shadow-indigo-950/20 active:scale-[0.99] flex items-center justify-center gap-2 overflow-hidden"
                    >
                      <CreditCard className="w-4 h-4 text-indigo-300" />
                      <span>{t.payNowBtn} • {formatInr(hero.remaining_balance)}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <div className="flex items-center justify-center gap-3 text-[11px] text-slate-500 font-medium">
                      <span>⚡ Instant GST Invoice</span>
                      <span>•</span>
                      <span>UPI / RuPay / Cards / NetBanking</span>
                      <span>•</span>
                      <span>100% Encrypted</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 space-y-2">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mx-auto shadow-inner">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900">
                    {t.allPaidTitle}
                  </h3>
                  <p className="text-xs text-slate-600 max-w-sm mx-auto">
                    {t.allPaidSub}
                  </p>
                </div>
              )}
            </section>

            {/* Tab Bar: Fee Plan & Receipts vs Academic Health */}
            <div className="flex rounded-2xl bg-slate-200/70 p-1.5 gap-1.5 shadow-inner">
              <button
                onClick={() => setActiveTab("FEES")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  activeTab === "FEES"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                {t.tabFeeSchedule}
              </button>
              <button
                onClick={() => setActiveTab("ACADEMIC")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  activeTab === "ACADEMIC"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                {t.tabAcademic}
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === "FEES" ? (
              /* Milestone Timeline Stepper */
              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Instalment Schedule & Receipts</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    {data.instalments.length} Total Instalments
                  </span>
                </div>

                <div className="space-y-4">
                  {data.instalments.map((inst, index) => {
                    const isPaid = inst.status === "PAID";
                    const isPartPaid = inst.status.includes("PART_PAID");
                    const isOverdue = inst.status.includes("OVERDUE");
                    const isUpcoming = inst.status === "UPCOMING";

                    return (
                      <div
                        key={inst.id}
                        className={`relative p-4 rounded-2xl border transition-all duration-200 ${
                          isOverdue
                            ? "bg-rose-50/40 border-rose-200 ring-1 ring-rose-300/40"
                            : isPaid
                            ? "bg-slate-50/70 border-slate-200"
                            : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-800">
                                #{inst.instalment_no}
                              </span>
                              <span className="text-sm font-bold text-slate-900">
                                {t.instalmentWord} #{inst.instalment_no}
                              </span>

                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  isPaid
                                    ? "bg-emerald-100 text-emerald-800"
                                    : isPartPaid
                                    ? "bg-amber-100 text-amber-900"
                                    : isOverdue
                                    ? "bg-rose-100 text-rose-900"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {isPaid
                                  ? t.paidBadge
                                  : isPartPaid
                                  ? t.partPaidBadge
                                  : isOverdue
                                  ? t.overdueBadge
                                  : t.upcomingBadge}
                              </span>

                              {inst.days_overdue > 0 && (
                                <span className="text-xs font-semibold text-rose-700">
                                  ({inst.days_overdue}d late)
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-slate-500 font-medium">
                              Due: <span className="font-mono text-slate-700">{inst.due_date}</span> •{" "}
                              Paid: <strong className="text-emerald-700 font-mono">{formatInr(inst.amount_paid)}</strong> of{" "}
                              <span className="font-mono">{formatInr(inst.amount_due)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            {inst.latest_receipt_no && (
                              <button
                                onClick={() => handleOpenReceipt(inst.latest_receipt_no!)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition shadow-2xs"
                              >
                                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                <span>{t.viewGstReceipt}</span>
                              </button>
                            )}

                            {inst.remaining_balance > 0 && student.status !== "WITHDRAWN" && (
                              <button
                                onClick={() => setPayingInstalment(inst)}
                                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm"
                              >
                                {t.payNowBtn}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Academic Health Tab */
              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-sm">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
                    <span className="font-bold text-slate-900">{t.attendanceTitle}</span>
                    <span className={`text-sm font-extrabold ${
                      student.attendance_pct >= 85
                        ? "text-emerald-700"
                        : student.attendance_pct >= 75
                        ? "text-amber-600"
                        : "text-rose-600"
                    }`}>
                      {student.attendance_pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-3.5 rounded-full bg-slate-100 overflow-hidden p-0.5 border border-slate-200/60">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        student.attendance_pct >= 85
                          ? "bg-emerald-600"
                          : student.attendance_pct >= 75
                          ? "bg-amber-500"
                          : "bg-rose-600"
                      }`}
                      style={{ width: `${Math.min(100, student.attendance_pct)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Target threshold: 85% attendance. Regular attendance ensures JEE / NEET syllabus continuity.
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <div className="text-xs font-bold text-slate-900 mb-3">
                    {t.mockTestsTitle}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {student.test_scores.map((score, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 text-center space-y-1"
                      >
                        <div className="text-[11px] font-semibold text-slate-500">
                          Mock #{idx + 1}
                        </div>
                        <div className="text-xl font-extrabold text-slate-900 font-mono">
                          {score}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Fee Breakdown & Reminders WhatsApp Stream (5 cols) */}
          <div className="lg:col-span-5 space-y-6">

            {/* Annual Fee Plan Summary Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900">
                  {t.annualFeeSummary}
                </h3>
                <span className="text-[11px] font-mono text-slate-500">
                  SAC 999293 (18% GST)
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>{t.grossFee}</span>
                  <span className="font-mono font-semibold">{formatInr(student.gross_annual_fee)}</span>
                </div>

                {student.scholarship_discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>{t.scholarshipDiscount}</span>
                    <span className="font-mono">-{formatInr(student.scholarship_discount)}</span>
                  </div>
                )}

                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-2 text-sm">
                  <span>{t.netAnnualFee}</span>
                  <span className="font-mono">{formatInr(student.net_annual_fee)}</span>
                </div>

                <div className="flex justify-between text-emerald-700 font-bold border-t border-slate-100 pt-2">
                  <span>{t.totalPaidToDate}</span>
                  <span className="font-mono">{formatInr(student.total_paid)}</span>
                </div>

                <div className="flex justify-between text-slate-900 font-extrabold text-sm border-t border-slate-100 pt-2">
                  <span>{t.remainingBalance}</span>
                  <span className={`font-mono ${student.total_balance > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                    {formatInr(student.total_balance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Automated Reminder Stream with Kill-Switch Stamp */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {t.remindersSection}
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  Bilingual SMS / WhatsApp
                </span>
              </div>

              <div className="space-y-3">
                {data.reminders.map((rem) => {
                  const isKilled = rem.status === "STOPPED_ON_PAYMENT";
                  const isSent = rem.status === "SENT";

                  return (
                    <div
                      key={rem.id}
                      className={`p-3.5 rounded-2xl border text-xs space-y-2 transition ${
                        isKilled
                          ? "bg-emerald-50/50 border-emerald-200"
                          : isSent
                          ? "bg-slate-50 border-slate-200"
                          : "bg-amber-50/30 border-amber-200/80"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] font-bold text-slate-600">
                          {rem.scheduled_date}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            isKilled
                              ? "bg-emerald-100 text-emerald-800"
                              : isSent
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isKilled && <BellOff className="w-3 h-3 text-emerald-700" />}
                          {isKilled
                            ? t.stoppedOnPayment
                            : isSent
                            ? t.sentStatus
                            : t.scheduledStatus}
                        </span>
                      </div>

                      <p className="text-slate-700 leading-relaxed font-medium">
                        {lang === "hi" ? rem.message_hi : rem.message_en}
                      </p>

                      {isKilled && (
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-lg">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Kill-Switch: Reminder stopped on payment</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Support Help Card */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 text-xs text-slate-600 space-y-1.5">
              <div className="font-bold text-slate-900">Need Help with Fees?</div>
              <p>
                Visit your centre office (Mon–Sat, 9:00 AM – 6:00 PM) or reach accounts support for receipt reprints and payment inquiries.
              </p>
            </div>

          </div>
        </div>

      </div>

      {payingInstalment && (
        <PaymentModal
          instalment={payingInstalment}
          studentName={student.name}
          lang={lang}
          onClose={() => setPayingInstalment(null)}
          onSuccess={(invoice) => {
            setPayingInstalment(null);
            setActiveInvoice(invoice);
            loadPortal();
          }}
        />
      )}

      {activeInvoice && (
        <GstReceiptModal
          invoice={activeInvoice}
          lang={lang}
          onClose={() => setActiveInvoice(null)}
        />
      )}
    </div>
  );
};
