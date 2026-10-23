import { Notice, type App } from 'obsidian';
import { VIEW_TYPE, type DataEditorHost } from './data-editor-view';

export function createEditorWorkspace(app: App) {
  const views = () => app.workspace.getLeavesOfType(VIEW_TYPE).map(leaf => leaf.view as DataEditorHost);

  async function open(): Promise<void> {
    const existing = app.workspace.getLeavesOfType(VIEW_TYPE)[0];

    if (existing) {
      await app.workspace.revealLeaf(existing);
      return;
    }

    const leaf = app.workspace.getRightLeaf(false);

    if (!leaf) {
      new Notice('Could not open the right sidebar.');
      return;
    }

    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    await app.workspace.revealLeaf(leaf);
  }

  function close(): void {
    app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async function toggle(): Promise<void> {
    if (views().length) close();
    else await open();
  }

  async function refresh(): Promise<void> {
    for (const view of views()) await view.editor.render();
  }

  async function refreshSync(id: string): Promise<void> {
    for (const view of views()) if (view.editor.getConnectionId() === id) await view.editor.refreshSyncStatus();
  }

  return {
    open,
    close,
    toggle,
    refresh,
    refreshSync
  };
}
