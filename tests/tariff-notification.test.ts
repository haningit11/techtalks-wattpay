import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSuccessNotificationTimer } from "@/components/features/tariffs/success-notification";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("tariff success notifications", () => {
  it.each(["created", "updated", "activated", "deactivated"])("dismisses a %s message after four seconds", (action) => {
    const setMessage = vi.fn();
    const notification = createSuccessNotificationTimer(setMessage);
    notification.show(`Tariff ${action}`);
    vi.advanceTimersByTime(3999);
    expect(setMessage).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(setMessage).toHaveBeenLastCalledWith("");
  });

  it("restarts the timer for a replacement, even with identical text", () => {
    const setMessage = vi.fn();
    const notification = createSuccessNotificationTimer(setMessage);
    notification.show("Saved");
    vi.advanceTimersByTime(3000);
    notification.show("Saved");
    vi.advanceTimersByTime(1000);
    expect(setMessage).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(3000);
    expect(setMessage).toHaveBeenLastCalledWith("");
  });

  it("ignores an old timer callback after a replacement", () => {
    const setMessage = vi.fn();
    let oldCallback: (() => void) | undefined;
    const schedule = globalThis.setTimeout;
    const spy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void, delay: number) => {
      oldCallback ??= callback;
      return schedule(callback, delay);
    }) as typeof setTimeout);
    const notification = createSuccessNotificationTimer(setMessage);
    notification.show("First");
    notification.show("Second");
    oldCallback?.();
    expect(setMessage).toHaveBeenLastCalledWith("Second");
    spy.mockRestore();
  });

  it("clears pending timers on dismissal and unmount, including late async results", () => {
    const setMessage = vi.fn();
    const notification = createSuccessNotificationTimer(setMessage);
    notification.show("Saved");
    notification.dismiss();
    vi.advanceTimersByTime(4000);
    expect(setMessage).toHaveBeenCalledTimes(2);
    notification.show("Saved again");
    notification.dispose();
    notification.show("Late response");
    vi.advanceTimersByTime(4000);
    expect(setMessage).toHaveBeenCalledTimes(3);
    notification.resume();
    notification.show("New session");
    expect(setMessage).toHaveBeenLastCalledWith("New session");
  });

  it("does not alter an independently displayed error", () => {
    let success = "";
    const error = "Unable to save";
    const notification = createSuccessNotificationTimer((message) => { success = message; });
    notification.show("Saved");
    vi.advanceTimersByTime(4000);
    expect(success).toBe("");
    expect(error).toBe("Unable to save");
  });
});
