export const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export interface UserProfile {
  id: number;
  phone: string;
  name: string;
  role: "PARENT" | "ACCOUNTS" | "COUNSELLOR";
  student_id: string | null;
  preferred_lang: "en" | "hi";
  dpdp_consent_given: boolean;
}

export interface InstalmentItem {
  id: number;
  student_id: string;
  instalment_no: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  remaining_balance: number;
  status: string;
  days_overdue: number;
  days_until_due: number;
  paid_at: string | null;
  latest_receipt_no: string | null;
}

export interface GstInvoice {
  receipt_no: string;
  institute_name: string;
  gstin: string;
  place_of_supply: string;
  sac_code: string;
  issued_at: string;
  student_id: string;
  student_name: string;
  centre: string;
  batch: string;
  instalment_no: number;
  instalment_due_date: string;
  payment_mode: string;
  idempotency_key: string;
  tax_breakdown: {
    taxable_base_inr: number;
    cgst_rate_pct: number;
    cgst_amount_inr: number;
    sgst_rate_pct: number;
    sgst_amount_inr: number;
    total_paid_inr: number;
  };
  instalment_summary: {
    instalment_total_inr: number;
    cumulative_paid_inr: number;
    remaining_balance_inr: number;
    status: string;
  };
}

export interface ParentPortalPayload {
  student: {
    id: string;
    name: string;
    centre: string;
    batch: string;
    parent_phone: string;
    status: string;
    course_start_date: string;
    course_end_date: string;
    gross_annual_fee: number;
    scholarship_discount: number;
    net_annual_fee: number;
    total_paid: number;
    total_balance: number;
    max_days_overdue: number;
    attendance_pct: number;
    test_scores: number[];
  };
  hero_due_card: InstalmentItem | null;
  additional_unpaid_count: number;
  instalments: InstalmentItem[];
  receipts: Array<{
    receipt_no: string;
    instalment_id: number;
    amount: number;
    base_amount: number;
    cgst_amount: number;
    sgst_amount: number;
    payment_mode: string;
    created_at: string;
  }>;
  reminders: Array<{
    id: number;
    instalment_id: number;
    trigger_type: string;
    scheduled_date: string;
    message_en: string;
    message_hi: string;
    status: string;
    stopped_reason: string | null;
  }>;
  refund_record: Record<string, any> | null;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("jaipur_jwt");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  // Defensive path normalization: avoid accidental /api/api double prefix
  const cleanPath = path.startsWith("/api/") ? path.slice(4) : path;
  const normalizedPath = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;

  const response = await fetch(`${API_BASE}${normalizedPath}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errBody = await response
      .json()
      .catch(() => ({ detail: "Request failed" }));
    throw new Error(errBody.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
