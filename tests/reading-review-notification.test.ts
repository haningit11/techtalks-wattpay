import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSuccessNotificationTimer } from "@/components/features/tariffs/success-notification";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Alert from "@/ui/components/feedback/Alert";
import ReadingDetails from "@/components/features/readings/ReadingDetails";
import type { ReviewReading } from "@/components/features/readings/review-client";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("reading review success notification", () => {
  it("dismisses after four seconds and supports manual dismissal", () => {
    const setNotice = vi.fn();
    const notification = createSuccessNotificationTimer(setNotice);
    notification.show("Reading resolved");
    vi.advanceTimersByTime(3999);
    expect(setNotice).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(setNotice).toHaveBeenLastCalledWith("");
    notification.show("Another reading resolved");
    notification.dismiss();
    expect(setNotice).toHaveBeenLastCalledWith("");
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(4000);
    expect(setNotice).toHaveBeenCalledTimes(4);
  });

  it("resets the timer on replacement and ignores a stale callback", () => {
    const setNotice = vi.fn();
    let staleCallback: (() => void) | undefined;
    const schedule = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void, delay: number) => {
      staleCallback ??= callback;
      return schedule(callback, delay);
    }) as typeof setTimeout);
    const notification = createSuccessNotificationTimer(setNotice);
    notification.show("First");
    vi.advanceTimersByTime(3000);
    notification.show("Second");
    staleCallback?.();
    vi.advanceTimersByTime(1000);
    expect(setNotice).toHaveBeenLastCalledWith("Second");
    vi.advanceTimersByTime(3000);
    expect(setNotice).toHaveBeenLastCalledWith("");
  });

  it("cancels timers on disposal and ignores late success responses", () => {
    const setNotice = vi.fn();
    const notification = createSuccessNotificationTimer(setNotice);
    notification.show("Reading resolved");
    notification.dispose();
    expect(vi.getTimerCount()).toBe(0);
    notification.show("Late response");
    vi.advanceTimersByTime(4000);
    expect(setNotice).toHaveBeenCalledTimes(1);
  });

  it("leaves independent error and dialog confirmation content visible after the success timer", () => {
    let success = "";
    const notification = createSuccessNotificationTimer((value) => { success = value; });
    const reading: ReviewReading = {
      id: "reading-id", billingMonth: "2026-11-01T00:00:00Z", previousReadingValue: "1000", submittedValue: "900", approvedValue: null, consumptionKwh: null, status: "FLAGGED", flagReason: "Below previous", reviewNote: null, createdAt: "2026-11-15T10:00:00Z",
      subscription: { amperage: "10", subscriber: { fullName: "Samir", address: "Beirut", building: { name: "Cedar" }, route: { name: "Route A" } } },
    };
    const error = () => renderToStaticMarkup(createElement(Alert, { variant: "danger", message: "Unable to load readings" }));
    const dialog = () => renderToStaticMarkup(createElement(ReadingDetails, { reading, resolved: { id: reading.id, status: "RESOLVED", approvedValue: "1000", consumptionKwh: "0", reviewNote: "Verified" }, onClose: vi.fn(), onResolved: vi.fn(), onConflict: vi.fn() }));
    notification.show("Reading resolved");
    vi.advanceTimersByTime(4000);
    expect(success).toBe("");
    expect(error()).toContain("Unable to load readings");
    expect(dialog()).toContain("Reading resolved");
    expect(dialog()).toContain("Calculated consumption: 0 kWh");
  });
});
