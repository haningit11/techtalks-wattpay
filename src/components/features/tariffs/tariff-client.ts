export type Tariff = {
  id: string;
  name: string;
  billingMonth: string;
  amperage: string;
  ratePerKwh: string;
  fixedFee: string;
  currency: string;
  isActive: boolean;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type TariffValues = Pick<Tariff, "name" | "billingMonth" | "amperage" | "ratePerKwh" | "fixedFee" | "currency">;

export class TariffApiError extends Error {
  constructor(public status: number, message: string, public historical = false) {
    super(message);
  }
}

export async function tariffRequest<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...options, cache: "no-store" });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new TariffApiError(0, "Unable to reach the tariff service. Check your connection and try again.");
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const historical = response.status === 409 && payload?.error?.reason === "HISTORICAL_PRICING";
    const messages: Record<number, string> = {
      400: "Please check the information you entered and try again.",
      401: "Your session has expired. Please sign in again.",
      403: "You do not have permission to manage tariffs.",
      404: "This tariff could not be found. It may no longer be available.",
      409: historical ? "This tariff has been used in a bill. Its month, tier and pricing are locked to protect billing history." : payload?.error?.reason === "DUPLICATE" ? "A tariff with this name or amperage already exists for this month." : "This change conflicts with an existing tariff or its billing history. Please review it and try again.",
    };
    throw new TariffApiError(response.status, messages[response.status] ?? "The tariff service is unavailable. Please try again later.", historical);
  }
  if (!payload || payload.success !== true || !("data" in payload)) throw new TariffApiError(500, "The tariff service returned an unexpected response. Please try again.");
  return payload.data as T;
}

export function setTariffActive(id: string, isActive: boolean): Promise<Tariff> {
  return tariffRequest<Tariff>(`/api/tariffs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive }),
  });
}

export function monthLabel(value: string): string {
  const [year, month] = value.slice(0, 7).split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

// Pad for display without converting the stored decimal string to a float.
export function decimalLabel(value: string, places: number): string {
  const [integer, fraction = ""] = value.split(".");
  return `${integer}.${fraction.replace(/0+$/, "").padEnd(places, "0")}`;
}

function comparableDecimal(value: string): string {
  const [integer, fraction = ""] = value.split(".");
  return `${integer.replace(/^0+(?=\d)/, "")}.${fraction.replace(/0+$/, "")}`;
}

/** Compare decimal text without converting it to a floating-point number. */
export function tariffChanges(values: TariffValues, original: TariffValues, locked = false): Partial<TariffValues> {
  const changes: Partial<TariffValues> = {};
  if (values.name.trim() !== original.name.trim()) changes.name = values.name.trim();
  if (locked) return changes;
  if (values.billingMonth !== original.billingMonth) changes.billingMonth = `${values.billingMonth}-01`;
  for (const key of ["amperage", "ratePerKwh", "fixedFee"] as const) {
    if (comparableDecimal(values[key]) !== comparableDecimal(original[key])) changes[key] = values[key];
  }
  if (values.currency !== original.currency) changes.currency = values.currency;
  return changes;
}
