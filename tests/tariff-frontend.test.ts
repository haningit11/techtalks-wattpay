import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TariffTable from "@/components/features/tariffs/TariffTable";
import TariffDetails from "@/components/features/tariffs/TariffDetails";
import { decimalLabel, monthLabel, setTariffActive, tariffChanges, tariffRequest, TariffApiError, type Tariff } from "@/components/features/tariffs/tariff-client";

const tariff: Tariff = { id: "tariff-uuid", name: "5A", billingMonth: "2026-11-01T00:00:00Z", amperage: "5", ratePerKwh: "0.45", fixedFee: "10", currency: "USD", isActive: false, createdByUserId: "creator-uuid", createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z" };

afterEach(() => vi.unstubAllGlobals());

describe("tariff frontend API handling", () => {
  it("retains decimal precision when formatting prices", () => {
    expect(decimalLabel("0.4501", 4)).toBe("0.4501");
    expect(decimalLabel("0.4500", 2)).toBe("0.45");
    expect(decimalLabel("0.5000", 2)).toBe("0.50");
    expect(decimalLabel("0.4501", 2)).toBe("0.4501");
    expect(decimalLabel("10", 2)).toBe("10.00");
    expect(monthLabel("2026-11-01T00:00:00.000Z")).toBe("November 2026");
  });
  it("returns the data from a successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: true, data: [{ name: "5A" }] })));
    await expect(tariffRequest("/api/tariffs")).resolves.toEqual([{ name: "5A" }]);
  });
  it("recognizes a billed tariff without treating all conflicts as historical", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ success: false, error: { code: "TARIFF_CONFLICT", reason: "HISTORICAL_PRICING", message: "any wording" } }, { status: 409 })).mockResolvedValueOnce(Response.json({ success: false, error: { code: "TARIFF_CONFLICT", reason: "DUPLICATE", message: "duplicate" } }, { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(tariffRequest("/api/tariffs/id")).rejects.toMatchObject({ status: 409, historical: true });
    await expect(tariffRequest("/api/tariffs/id")).rejects.toMatchObject({ status: 409, historical: false });
  });
  it("does not mislabel an unknown conflict as a duplicate or historical", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: false, error: { code: "TARIFF_CONFLICT" } }, { status: 409 })));
    await expect(tariffRequest("/api/tariffs/id")).rejects.toMatchObject({ historical: false, message: "This change conflicts with an existing tariff or its billing history. Please review it and try again." });
  });
  it("sends only edited values and treats equivalent decimal strings as unchanged", () => {
    const original = { name: "5A", billingMonth: "2026-11", amperage: "5", ratePerKwh: "0.45", fixedFee: "10", currency: "USD" };
    expect(tariffChanges({ ...original, name: "New name", amperage: "5.00", ratePerKwh: "0.4500", fixedFee: "10.00" }, original)).toEqual({ name: "New name" });
    expect(tariffChanges({ ...original, ratePerKwh: "0.4501", billingMonth: "2026-12" }, original)).toEqual({ ratePerKwh: "0.4501", billingMonth: "2026-12-01" });
    expect(tariffChanges({ ...original, name: "New", fixedFee: "20" }, original, true)).toEqual({ name: "New" });
  });
  it.each([true, false])("sends the requested activation status %s", async (isActive) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ success: true, data: { ...tariff, isActive } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(setTariffActive(tariff.id, isActive)).resolves.toMatchObject({ isActive });
    expect(fetchMock).toHaveBeenCalledWith("/api/tariffs/tariff-uuid", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ isActive }) }));
  });
  it("renders the right status actions and omits raw IDs from details", () => {
    const callbacks = { onView: vi.fn(), onEdit: vi.fn(), onToggleStatus: vi.fn() };
    const inactive = renderToStaticMarkup(createElement(TariffTable, { tariffs: [tariff], ...callbacks }));
    const active = renderToStaticMarkup(createElement(TariffTable, { tariffs: [{ ...tariff, isActive: true }], ...callbacks }));
    expect(inactive).toContain("Activate 5A");
    expect(active).toContain("Deactivate 5A");
    const details = renderToStaticMarkup(createElement(TariffDetails, { tariff, onClose: vi.fn() }));
    expect(details).not.toContain("tariff-uuid");
    expect(details).not.toContain("creator-uuid");
  });
  it.each([400, 401, 403, 404, 500])("provides safe messages for status %i", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: false, error: { message: "sensitive internal details" } }, { status })));
    try { await tariffRequest("/api/tariffs"); throw new Error("Expected failure"); } catch (error) {
      expect(error).toBeInstanceOf(TariffApiError);
      expect((error as TariffApiError).status).toBe(status);
      expect((error as Error).message).not.toContain("sensitive internal details");
    }
  });
});
