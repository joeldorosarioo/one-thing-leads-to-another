export function createSyncScheduler(options: {
  isEnabled(id: string): boolean;
  run(id: string): Promise<unknown>;
  delay?: number;
}) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let disposed = false;

  function cancel(id: string): void {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
  }

  function schedule(id: string): void {
    cancel(id);
    if (disposed || !options.isEnabled(id)) return;

    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id);
        if (!disposed && options.isEnabled(id)) void options.run(id);
      }, options.delay ?? 500)
    );
  }

  function dispose(): void {
    disposed = true;
    for (const id of timers.keys()) cancel(id);
  }

  return {
    schedule,
    cancel,
    dispose
  };
}
