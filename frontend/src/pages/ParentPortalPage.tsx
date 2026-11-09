import React, { useEffect, useState } from "react";
import {
  Globe,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  BellOff,
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
      <div className="max-w-[420px] mx-auto p-4 space-y-4">
        <div className="h-14 rounded-2xl bg-slate-200 animate-pulse" />
        <div className="h-48 rounded-2xl bg-slate-200 animate-pulse" />
        <div className="h-64 rounded-2xl bg-slate-200 animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-[420px] mx-auto p-6">
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error || "Portal unavailable"}
        </div>
      </div>
    );
  }

  const { student, hero_due_card: hero } = data;
  const hasDueNow = hero && hero.remaining_balance > 0 && student.status !== "WITHDRAWN";

  return (
    <div className="min-h-screen bg-slate-100 py-4 px-3">
      <div className="max-w-[420px] mx-auto space-y-4">
        {/* Minimal Mobile Header */}
        <header className="bg-white rounded-2xl border border-slate-200 px-4 py-3.5 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-xs font-semibold text-slate-500">
              {t.instituteTitle}
            </div>
            <h1 className="text-base font-bold text-slate-900">
              {student.name}{" "}
              <span className="text-xs font-normal text-slate-500">
                ({student.id})
              </span>
            </h1>
            <div className="text-xs text-slate-500">
              {student.batch} • {student.centre}
            </div>
          </div>

          <button
            onClick={() => setLang(lang === "en" ? "hi" : "en")}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-900 shrink-0"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === "en" ? "हिंदी" : "EN"}
          </button>
        </header>

        {/* THE 5-SECOND RULE HERO CARD: Amount, Due Date, and Pay Button — Nothing More */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          {hasDueNow && hero ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t.amountDueNow} ({t.instalmentWord} #{hero.instalment_no})
                </span>
                {hero.days_overdue > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {hero.days_overdue} {t.daysOverdue}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                    <Clock className="w-3.5 h-3.5" />
                    {t.dueInDays} {hero.days_until_due} {t.daysWord}
                  </span>
                )}
              </div>

              <div className="text-4xl font-extrabold text-slate-900 tracking-tight my-2">
                {formatInr(hero.remaining_balance)}
              </div>

              <div className="text-xs text-slate-600 mb-5">
                {t.dueDate}:{" "}
                <strong className="text-slate-900">{hero.due_date}</strong>
                {hero.amount_paid > 0 && (
                  <span className="ml-2 text-emerald-700 font-medium">
                    ({t.partPaidBadge}: {formatInr(hero.amount_paid)} /{" "}
                    {formatInr(hero.amount_due)})
                  </span>
                )}
              </div>

              <button
                onClick={() => setPayingInstalment(hero)}
                className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-base transition shadow-sm"
              >
                {t.payNowBtn} • {formatInr(hero.remaining_balance)} →
              </button>
            </div>
          ) : (
            <div className="text-center py-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              <div className="text-lg font-bold text-slate-900">
                {t.allPaidTitle}
              </div>
              <p className="text-xs text-slate-500 mt-1">{t.allPaidSub}</p>
            </div>
          )}
        </section>

        {/* Below the Fold Navigation Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-slate-200/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("FEES")}
            className={`py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === "FEES"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.tabFeeSchedule}
          </button>
          <button
            onClick={() => setActiveTab("ACADEMIC")}
            className={`py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === "ACADEMIC"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.tabAcademic}
          </button>
        </div>

        {activeTab === "FEES" ? (
          <div className="space-y-4">
            {/* Instalments List */}
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-sm">
              {data.instalments.map((inst) => (
                <div
                  key={inst.id}
                  className="p-4 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {t.instalmentWord} #{inst.instalment_no}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          inst.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800"
                            : inst.status.includes("OVERDUE")
                            ? "bg-red-100 text-red-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {inst.status === "PAID"
                          ? t.paidBadge
                          : inst.status.includes("PART_PAID")
                          ? t.partPaidBadge
                          : inst.status === "OVERDUE"
                          ? t.overdueBadge
                          : t.upcomingBadge}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {t.dueDate}: {inst.due_date} • {formatInr(inst.amount_paid)}{" "}
                      / {formatInr(inst.amount_due)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {inst.latest_receipt_no && (
                      <button
                        onClick={() =>
                          handleOpenReceipt(inst.latest_receipt_no!)
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {t.viewGstReceipt}
                      </button>
                    )}
                    {inst.remaining_balance > 0 &&
                      student.status !== "WITHDRAWN" && (
                        <button
                          onClick={() => setPayingInstalment(inst)}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                        >
                          {t.payNowBtn}
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>

            {/* Annual Plan Summary */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-xs shadow-sm">
              <div className="font-bold text-slate-800 mb-1">
                {t.annualFeeSummary}
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{t.grossFee}</span>
                <span>{formatInr(student.gross_annual_fee)}</span>
              </div>
              {student.scholarship_discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>{t.scholarshipDiscount}</span>
                  <span>-{formatInr(student.scholarship_discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-100 pt-1.5">
                <span>{t.netAnnualFee}</span>
                <span>{formatInr(student.net_annual_fee)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>{t.totalPaidToDate}</span>
                <span>{formatInr(student.total_paid)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900">
                <span>{t.remainingBalance}</span>
                <span>{formatInr(student.total_balance)}</span>
              </div>
            </div>

            {/* Bilingual Automated Reminder Log Preview */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5 shadow-sm">
              <div className="text-xs font-bold text-slate-800">
                {t.remindersSection}
              </div>
              {data.reminders.map((rem) => (
                <div
                  key={rem.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-slate-500">
                      {rem.scheduled_date}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        rem.status === "STOPPED_ON_PAYMENT"
                          ? "bg-emerald-100 text-emerald-800"
                          : rem.status === "SENT"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {rem.status === "STOPPED_ON_PAYMENT" && (
                        <BellOff className="w-3 h-3" />
                      )}
                      {rem.status === "STOPPED_ON_PAYMENT"
                        ? t.stoppedOnPayment
                        : rem.status === "SENT"
                        ? t.sentStatus
                        : t.scheduledStatus}
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    {lang === "hi" ? rem.message_hi : rem.message_en}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Attendance & Test Scores Tab */
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5 shadow-sm">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
                <span>{t.attendanceTitle}</span>
                <span className="text-sm font-bold text-slate-900">
                  {student.attendance_pct.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    student.attendance_pct >= 85
                      ? "bg-emerald-600"
                      : student.attendance_pct >= 75
                      ? "bg-amber-500"
                      : "bg-red-600"
                  }`}
                  style={{ width: `${Math.min(100, student.attendance_pct)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-600 mb-2.5">
                {t.mockTestsTitle}
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {student.test_scores.map((score, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center"
                  >
                    <div className="text-[11px] text-slate-500">
                      Test #{idx + 1}
                    </div>
                    <div className="text-lg font-bold text-slate-900 mt-0.5">
                      {score}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
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
