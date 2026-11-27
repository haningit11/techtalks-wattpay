import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type KeyboardEvent, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FlaggedReadingsPage from "@/app/admin/readings/page";
import FlaggedReadingTable, { FlagReason } from "@/components/features/readings/FlaggedReadingTable";
import ReadingDetails from "@/components/features/readings/ReadingDetails";
import ReviewReadingForm from "@/components/features/readings/ReviewReadingForm";
import { listFlaggedReadings, ReviewApiError, submitReview, validateReview, type ReviewReading } from "@/components/features/readings/review-client";

const reading: ReviewReading = {
  id: "reading-id", billingMonth: "2026-11-01T00:00:00.000Z", previousReadingValue: "1000.001", submittedValue: "999.999", approvedValue: null, consumptionKwh: null, status: "FLAGGED", flagReason: "Below previous", reviewNote: null, createdAt: "2026-11-15T10:00:00.000Z",
  subscription: { amperage: "10", subscriber: { fullName: "Samir Khalil", address: "Beirut", building: { name: "Cedar" }, route: { name: "Route A" } } },
};
afterEach(() => vi.unstubAllGlobals());

describe("reading review frontend", () => {
  it("renders a compact table and mobile cards with full flag reasons and separate review actions", () => {
    const longReason = "Calculated consumption exceeds the configured high-consumption threshold. " + "Additional context ".repeat(12);
    const row = { ...reading, flagReason: longReason };
    const table = renderToStaticMarkup(createElement(FlaggedReadingTable, { readings: [row], onReview: vi.fn() }));
    expect(table).toContain("High consumption");
    expect(table.split(longReason)).toHaveLength(3);
    expect(table).toContain("table-fixed");
    expect(table).toContain("md:hidden");
    expect(table).toContain("md:block");
    expect(table).toContain("<article");
    expect(table).toContain('<details');
    expect(table).toContain('<summary');
    expect(table).toContain('aria-label="Show flag reason for Samir Khalil"');
    expect(table).toContain('aria-label="Review reading for Samir Khalil, November 2026"');
    expect(table).not.toContain("Scroll horizontally");
    const details = renderToStaticMarkup(createElement(ReadingDetails, { reading: row, resolved: null, onClose: vi.fn(), onResolved: vi.fn(), onConflict: vi.fn() }));
    expect(details).toContain(longReason);
  });
  it("uses a native disclosure and returns focus to its summary when Escape is pressed", () => {
    const disclosure = FlagReason({ reason: "Submitted reading equals the previous reading (zero consumption).", subscriber: "Samir" }) as ReactElement<{ onKeyDown: (event: KeyboardEvent<HTMLDetailsElement>) => void; children: ReactElement[] }>;
    expect(disclosure.type).toBe("details");
    const summary = disclosure.props.children[0];
    expect(isValidElement(summary) && summary.type).toBe("summary");
    const focus = vi.fn();
    const preventDefault = vi.fn();
    const target = { open: true, querySelector: vi.fn(() => ({ focus })) };
    disclosure.props.onKeyDown({ key: "Escape", currentTarget: target, preventDefault } as unknown as KeyboardEvent<HTMLDetailsElement>);
    expect(target.open).toBe(false);
    expect(focus).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
    const markup = renderToStaticMarkup(createElement(FlagReason, { reason: "Submitted reading equals the previous reading (zero consumption).", subscriber: "Samir" }));
    expect(markup).toContain("Zero consumption");
  });
  it("keeps the reason disclosure independent from the review action", () => {
    const onReview = vi.fn();
    const tree = FlaggedReadingTable({ readings: [reading], onReview });
    const components: ReactElement<{ reading: ReviewReading; onReview: typeof onReview }>[] = [];
    function visit(node: unknown): void {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!isValidElement<{ children?: unknown }>(node)) return;
      if (typeof node.type === "function" && node.type.name === "ReviewButton") components.push(node as ReactElement<{ reading: ReviewReading; onReview: typeof onReview }>);
      visit(node.props.children);
    }
    visit(tree);
    expect(components).toHaveLength(2);
    const disclosure = FlagReason({ reason: reading.flagReason, subscriber: "Samir" });
    const summary = (disclosure.props as { children: ReactElement[] }).children[0];
    expect((summary.props as { onClick?: unknown }).onClick).toBeUndefined();
    expect(onReview).not.toHaveBeenCalled();
    const button = (components[0].type as (props: typeof components[0]["props"]) => ReactElement<{ onClick: () => void }>)(components[0].props);
    button.props.onClick();
    expect(onReview).toHaveBeenCalledExactlyOnceWith(reading);
  });
  it("renders the loading page, table, details and form with available context", () => {
    expect(renderToStaticMarkup(createElement(FlaggedReadingsPage))).toContain("Loading readings");
    const table = renderToStaticMarkup(createElement(FlaggedReadingTable, { readings: [reading], onReview: vi.fn() }));
    for (const text of ["Samir Khalil", "Cedar", "November 2026", "1000.001", "999.999", "Below previous", "Review"]) expect(table).toContain(text);
    const details = renderToStaticMarkup(createElement(ReadingDetails, { reading, resolved: null, onClose: vi.fn(), onResolved: vi.fn(), onConflict: vi.fn() }));
    for (const text of ["Samir Khalil", "Beirut", "Route A", "10 A", "Original submitted reading", "Approved reading", "Flagged"]) expect(details.toLowerCase()).toContain(text.toLowerCase());
    expect(details).not.toContain("reading-id");
    const form = renderToStaticMarkup(createElement(ReviewReadingForm, { id: reading.id, previous: reading.previousReadingValue, onResolved: vi.fn(), onConflict: vi.fn() }));
    expect(form).toContain('for="approved-reading"');
    expect(form).toContain('for="review-note"');
  });
  it("validates decimals and required notes without floating-point conversion", () => {
    expect(validateReview("1000.001", "ok", "1000.001")).toEqual({});
    expect(validateReview("999.999", "ok", "1000.001").value).toMatch(/lower/);
    expect(validateReview("999999999.998", "ok", "999999999.999").value).toMatch(/lower/);
    for (const invalid of ["-1", "1.0001", "1000000000", "1e3", ""]) expect(validateReview(invalid, "ok", "0").value).toBeDefined();
    expect(validateReview("1000", "   ", "0").note).toBeDefined();
    expect(validateReview("1000", "note", null).value).toMatch(/missing/);
  });
  it("filters the flagged list and handles empty responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ success: true, data: [reading, { ...reading, id: "resolved", status: "RESOLVED" }] })).mockResolvedValueOnce(Response.json({ success: true, data: [] })));
    expect(await listFlaggedReadings()).toEqual([reading]);
    expect(await listFlaggedReadings()).toEqual([]);
  });
  it("submits only the review fields and fetches an updated empty list after resolution", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ success: true, data: { id: reading.id, status: "RESOLVED", approvedValue: "1000.001", consumptionKwh: "0", reviewNote: "verified" } })).mockResolvedValueOnce(Response.json({ success: true, data: [] }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await submitReview(reading.id, "1000.001", " verified ")).toMatchObject({ status: "RESOLVED", consumptionKwh: "0" });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/readings/reading-id/review", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ approvedValue: "1000.001", reviewNote: "verified" }) }));
    expect(await listFlaggedReadings()).toEqual([]);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/readings?status=FLAGGED", expect.anything());
  });
  it("exposes conflict messages and reasons without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ success: false, error: { message: "Already resolved", reason: "NOT_FLAGGED" } }, { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(submitReview(reading.id, "1000.001", "checked")).rejects.toMatchObject({ message: "Already resolved", status: 409, reason: "NOT_FLAGGED" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("returns safe errors for network failures and server errors", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(Response.json({ success: false, error: { message: "private details" } }, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(listFlaggedReadings()).rejects.toBeInstanceOf(ReviewApiError);
    await expect(listFlaggedReadings()).rejects.toMatchObject({ status: 500, message: "Unable to complete the request. Please try again." });
  });
});
