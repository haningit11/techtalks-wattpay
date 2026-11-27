export type ReviewReading = {
  id: string;
  billingMonth: string;
  previousReadingValue: string | null;
  submittedValue: string;
  approvedValue: string | null;
  consumptionKwh: string | null;
  status: string;
  flagReason: string | null;
  reviewNote: string | null;
  createdAt: string;
  subscription: {
    amperage: string;
    subscriber: { fullName: string; address: string; building: { name: string }; route: { name: string } };
  };
};

export type ResolvedReading = Pick<ReviewReading, "id" | "status" | "approvedValue" | "consumptionKwh" | "reviewNote">;

export class ReviewApiError extends Error {
  constructor(message: string, readonly status: number, readonly reason?: string) { super(message); }
}

export async function reviewRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { ...options, cache: "no-store" }); }
  catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ReviewApiError("Unable to reach the server. Please try again.", 0);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const fallback = response.status === 401 ? "Please sign in to continue." : response.status === 403 ? "You do not have permission to review readings." : response.status === 404 ? "The reading could not be found." : response.status === 409 ? "This reading conflicts with its current history." : "Unable to complete the request. Please try again.";
    const message = (response.status === 400 || response.status === 409) && typeof payload?.error?.message === "string" ? payload.error.message : fallback;
    throw new ReviewApiError(message, response.status, payload?.error?.reason);
  }
  return payload.data as T;
}

export function listFlaggedReadings(signal?: AbortSignal): Promise<ReviewReading[]> {
  return reviewRequest<ReviewReading[]>("/api/readings?status=FLAGGED", { signal }).then((items) => items.filter((item) => item.status === "FLAGGED"));
}

export function submitReview(id: string, approvedValue: string, reviewNote: string): Promise<ResolvedReading> {
  return reviewRequest(`/api/readings/${encodeURIComponent(id)}/review`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approvedValue: approvedValue.trim(), reviewNote: reviewNote.trim() }),
  });
}

// Compare the decimal strings directly; neither input is converted to a floating-point number.
export function validateReview(value: string, note: string, previous: string | null): { value?: string; note?: string } {
  const errors: { value?: string; note?: string } = {};
  const trimmed = value.trim();
  if (!/^\d{1,9}(?:\.\d{1,3})?$/.test(trimmed)) errors.value = "Enter a nonnegative reading with up to 9 digits and 3 decimal places.";
  else if (previous === null) errors.value = "The previous reading is missing; this reading cannot be reviewed.";
  else {
    const parts = (decimal: string) => { const [whole, fraction = ""] = decimal.split("."); return (whole.replace(/^0+/, "") || "0").padStart(9, "0") + fraction.padEnd(3, "0"); };
    if (parts(trimmed) < parts(previous)) errors.value = "Approved reading cannot be lower than the previous reading.";
  }
  if (!note.trim()) errors.note = "Enter a review note.";
  return errors;
}

export function monthLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}
