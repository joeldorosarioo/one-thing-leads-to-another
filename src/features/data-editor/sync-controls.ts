import { deriveSyncControls, type SyncResult } from '../../application/synchronization/sync-policy';
import { errorMessage } from '../../shared/error-message';

interface SyncButton {
  setDisabled(disabled: boolean): unknown;
  setTooltip(text: string): unknown;
}

interface SyncLabel {
  setText(text: string): unknown;
  toggleClass(name: string, enabled: boolean): unknown;
  removeClass(name: string): unknown;
}

export function createSyncControls(options: {
  inspect(id: string): Promise<SyncResult>;
  isAutomatic(id: string): boolean;
}) {
  let version = 0;
  let disposed = false;
  let canSync = false;
  let result: SyncResult | null = null;

  function invalidate(): void {
    version++;
    canSync = false;
  }

  async function refresh(id: string, button: SyncButton, label: SyncLabel): Promise<void> {
    if (disposed) return;

    const check = ++version;

    canSync = false;
    button.setDisabled(true);

    try {
      const status = await options.inspect(id);
      if (disposed || check !== version) return;

      const controls = deriveSyncControls(status, options.isAutomatic(id));

      result = status;
      canSync = controls.canManualSync;
      button.setDisabled(!canSync);

      button.setTooltip(
        controls.status === 'conflict'
          ? 'Review and confirm overwrite'
          : canSync
            ? 'Sync pending changes'
            : controls.status === 'automatic'
              ? 'Updating automatically'
              : 'Report is up to date'
      );

      label.setText(controls.label);
      label.toggleClass('nts-sync-pending', controls.status === 'pending' || controls.status === 'conflict');
    } catch (error) {
      if (disposed || check !== version) return;

      button.setDisabled(true);
      button.setTooltip('Resolve the error before syncing');

      label.setText(`Cannot sync: ${errorMessage(error)}`);
      label.removeClass('nts-sync-pending');
    }
  }

  return {
    refresh,
    invalidate,
    canSync: () => canSync,
    result: () => result,

    dispose() {
      disposed = true;
      invalidate();
    }
  };
}
