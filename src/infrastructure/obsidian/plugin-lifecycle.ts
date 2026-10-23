import { Notice, PluginSettingTab, requireApiVersion, type Plugin, type SettingDefinitionItem } from 'obsidian';
import type { PluginActions } from '../../application/plugin-actions';
import { createConnectionModal } from '../../features/connections/connection-modal';
import { getConnectionSettingDefinitions, renderConnectionSettings } from '../../features/connections/settings-tab';
import { createDataEditorView, VIEW_TYPE } from './data-editor-view';
import type { createEditorWorkspace } from './editor-workspace';

export function registerPlugin(
  plugin: Plugin,
  actions: PluginActions,
  editor: ReturnType<typeof createEditorWorkspace>
) {
  const { app } = plugin;

  let disposed = false;

  plugin.registerView(VIEW_TYPE, leaf => createDataEditorView(leaf, actions));
  plugin.addRibbonIcon('sliders-horizontal', 'Toggle data editor', editor.toggle);
  plugin.addCommand({ id: 'open-data-editor', name: 'Open data editor', callback: editor.open });

  plugin.addCommand({
    id: 'create-document-connection',
    name: 'Create document connection',
    callback: () => createConnectionModal(app, actions).open()
  });

  plugin.addCommand({
    id: 'regenerate-all',
    name: 'Regenerate all documents',

    callback: async () => {
      for (const connection of actions.listConnections()) await actions.syncConnection(connection.id, { notify: true });
    }
  });

  plugin.addSettingTab(
    new (class extends PluginSettingTab {
      getSettingDefinitions(): SettingDefinitionItem[] {
        return getConnectionSettingDefinitions(app, actions, () => {
          if (requireApiVersion('1.13.0')) this.update();
          else renderConnectionSettings(this.containerEl, app, actions);
        });
      }

      display(): void {
        renderConnectionSettings(this.containerEl, app, actions);
      }
    })(app, plugin)
  );

  app.workspace.onLayoutReady(() => {
    if (disposed) return;

    if (app.workspace.getLeavesOfType(VIEW_TYPE).length) {
      editor.close();
      void editor.open();
    }

    for (const connection of actions.listConnections()) if (connection.enabled) actions.queueSync(connection.id);
  });

  plugin.registerEvent(
    app.vault.on('modify', file => {
      for (const connection of actions.listConnections()) {
        if (file.path === connection.data_path || file.path === connection.template_path) {
          void editor.refreshSync(connection.id);
          actions.queueSync(connection.id);
        } else if (file.path === connection.output_path) {
          void editor.refreshSync(connection.id);
        }
      }
    })
  );

  plugin.registerEvent(
    app.vault.on('rename', async (file, oldPath) => {
      if (await actions.relocateConnections(oldPath, file.path)) await editor.refresh();
    })
  );

  plugin.registerEvent(
    app.vault.on('delete', file => {
      for (const connection of actions.listConnections()) {
        if (
          [connection.data_path, connection.template_path, connection.output_path].some(
            path => path === file.path || path.startsWith(file.path + '/')
          )
        ) {
          new Notice(`Note Template Sync: a connected file or folder was removed: ${file.path}`, 7000);
        }
      }
    })
  );

  return () => {
    disposed = true;
    actions.dispose();
    editor.close();
  };
}
