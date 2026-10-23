import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSyncScheduler } from '../../src/application/synchronization/sync-scheduler';

afterEach(() => vi.useRealTimers());

describe('automatic synchronization scheduling', () => {
  it('coalesces repeated changes and waits until editing has paused', async () => {
    vi.useFakeTimers();

    const generated: string[] = [];

    const scheduler = createSyncScheduler({
      isEnabled: () => true,

      run: async id => {
        generated.push(id);
      }
    });

    scheduler.schedule('connection');
    await vi.advanceTimersByTimeAsync(300);

    scheduler.schedule('connection');
    await vi.advanceTimersByTimeAsync(499);

    expect(generated).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);

    expect(generated).toEqual(['connection']);
    scheduler.dispose();
  });

  it('checks automatic sync again before running queued work', async () => {
    vi.useFakeTimers();

    let enabled = true;

    const generated: string[] = [];

    const scheduler = createSyncScheduler({
      isEnabled: () => enabled,

      run: async id => {
        generated.push(id);
      }
    });

    scheduler.schedule('connection');
    enabled = false;

    await vi.advanceTimersByTimeAsync(500);
    expect(generated).toEqual([]);
  });

  it('cancels queued work on disposal and refuses to schedule new work', async () => {
    vi.useFakeTimers();

    const generated: string[] = [];

    const scheduler = createSyncScheduler({
      isEnabled: () => true,

      run: async id => {
        generated.push(id);
      }
    });

    scheduler.schedule('before');
    scheduler.dispose();
    scheduler.schedule('after');

    await vi.advanceTimersByTimeAsync(1000);
    expect(generated).toEqual([]);
  });
});
