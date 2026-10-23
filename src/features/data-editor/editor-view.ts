import type { ExtraButtonComponent, ItemView } from 'obsidian';
import type { EditorActions } from '../../application/plugin-actions';
import { validateData } from '../../domain/data-model';
import type { CalculatedValues, PortableDocument } from '../../domain/document-types';
import { errorMessage } from '../../shared/error-message';
import { createCalculatedFields } from './calculated-fields';
import { createEditableFields } from './editable-fields';
import { createEditorDialogs } from './editor-dialogs';
import { createEditorNavigation } from './editor-navigation';
import { createSyncControls } from './sync-controls';

export function createEditorController(host: Pick<ItemView, 'app' | 'contentEl' | 'leaf'>, actions: EditorActions) {
  const state = {
    connectionId: null as string | null,
    syncButton: null as ExtraButtonComponent | null,
    syncStatusEl: null as HTMLElement | null,
    renderVersion: 0,
    disposed: false
  };

  const syncControls = createSyncControls({
    inspect: actions.inspectConnection,
    isAutomatic: id => actions.listConnections().find(connection => connection.id === id)?.enabled ?? false
  });

  const dialogs = createEditorDialogs(host.app, actions, render);

  const navigation = createEditorNavigation({
    app: host.app,
    actions,
    close: () => host.leaf.detach(),

    async selectConnection(id) {
      state.connectionId = id;
      await render();
    },

    async syncConnection(connection) {
      if (!state.syncButton || !syncControls.canSync()) return;
      syncControls.invalidate();
      state.syncButton.setDisabled(true);

      if (syncControls.result() === 'conflict') dialogs.confirmOverwrite(connection);
      else await actions.syncConnection(connection.id, { notify: true });
      await refreshSyncStatus();
    }
  });

  const renderEditableFields = createEditableFields({
    app: host.app,
    actions,
    onValueSaved: refreshCalculatedValues,
    onSaveFailed: render,
    onDelete: (id, key) => dialogs.askDelete(id, key, false)
  });

  const renderCalculatedFields = createCalculatedFields({
    app: host.app,
    actions,
    onDelete: (id, key) => dialogs.askDelete(id, key, true)
  });

  async function render(): Promise<void> {
    if (state.disposed) return;
    const version = ++state.renderVersion;
    const root = host.contentEl;

    root.empty();
    root.addClass('nts-editor');
    state.syncButton = null;
    state.syncStatusEl = null;
    syncControls.invalidate();

    const page = root.createDiv({
      cls: 'nts-page'
    });

    navigation.renderHeading(page);

    const connections = actions.listConnections();

    if (!connections.length) {
      page.createEl('p', {
        text: 'Connect a JSON data file, a Markdown template, and an output note to begin.',
        cls: 'nts-help'
      });

      return;
    }

    const connection = connections.find(item => item.id === state.connectionId) ?? connections[0];
    state.connectionId = connection.id;

    const controls = navigation.renderToolbar(page, connection);
    state.syncButton = controls.syncButton;
    state.syncStatusEl = controls.syncStatusEl;

    let document: PortableDocument;
    let calculated: CalculatedValues;

    try {
      document = (await actions.readSource(connection.id)).data;
      if (version !== state.renderVersion || state.disposed) return;
      calculated = validateData(document);
    } catch (err) {
      page.createEl('p', {
        text: `Could not read data: ${errorMessage(err)}`,
        cls: 'nts-warning'
      });

      await refreshSyncStatus();
      return;
    }

    renderEditableFields(page, connection, document);
    renderCalculatedFields(page, connection, document, calculated);

    page.createEl('p', {
      text: connection.enabled
        ? 'Values are saved when you finish editing. Automatic updates keep your report current.'
        : 'Values are saved when you finish editing. Use Sync when you are ready to update the report.',
      cls: 'nts-help'
    });

    await refreshSyncStatus();
  }

  async function refreshSyncStatus(): Promise<void> {
    if (state.syncButton && state.syncStatusEl && state.connectionId) {
      await syncControls.refresh(state.connectionId, state.syncButton, state.syncStatusEl);
    }
  }

  async function refreshCalculatedValues(connectionId: string): Promise<void> {
    const { data } = await actions.readSource(connectionId);
    const values = validateData(data);
    const root = host.contentEl;

    for (const card of Array.from(root.querySelectorAll<HTMLElement>('.nts-formula'))) {
      const input = card.querySelector('input');
      const key = card.dataset.formulaKey;

      if (input && key !== undefined && Object.prototype.hasOwnProperty.call(values, key))
        input.value = String(values[key]);
    }

    await refreshSyncStatus();
  }

  return {
    render,
    refreshSyncStatus,
    getConnectionId: () => state.connectionId,

    dispose() {
      state.disposed = true;
      syncControls.dispose();
      state.renderVersion++;
    }
  };
}
