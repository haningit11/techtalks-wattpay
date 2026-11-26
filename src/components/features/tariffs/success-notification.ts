/** Manage only the tariff page's success notification. */
export function createSuccessNotificationTimer(setMessage: (message: string) => void) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let active = true;

  function cancel() {
    generation += 1;
    if (timeout !== undefined) clearTimeout(timeout);
    timeout = undefined;
  }

  return {
    show(message: string) {
      if (!active) return;
      cancel();
      setMessage(message);
      const current = generation;
      timeout = setTimeout(() => {
        if (current !== generation) return;
        timeout = undefined;
        setMessage("");
      }, 4000);
    },
    dismiss() {
      if (!active) return;
      cancel();
      setMessage("");
    },
    resume() {
      active = true;
    },
    dispose() {
      active = false;
      cancel();
    },
  };
}
