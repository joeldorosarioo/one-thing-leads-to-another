import { Notice, Plugin } from 'obsidian';
import { createPluginActions, type PluginActions } from '../../application/plugin-actions';
import { createEditorWorkspace } from './editor-workspace';
import { registerPlugin } from './plugin-lifecycle';

export default class TemplateSyncPlugin extends Plugin {
  actions!: PluginActions;
  editor!: ReturnType<typeof createEditorWorkspace>;

  private dispose: (() => void) | undefined;

  async onload(): Promise<void> {
    this.editor = createEditorWorkspace(this.app);

    this.actions = createPluginActions({
      vault: this.app.vault,
      savedSettings: await this.loadData(),
      saveSettings: settings => this.saveData(settings),

      notify: (message, duration) => {
        new Notice(message, duration);
      },

      refreshEditors: this.editor.refresh,
      refreshSync: this.editor.refreshSync
    });

    this.dispose = registerPlugin(this, this.actions, this.editor);
  }

  onunload(): void {
    this.dispose?.();
  }
}
