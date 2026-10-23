import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { createEditorController } from '../../features/data-editor/editor-view';
import type { EditorActions } from '../../application/plugin-actions';

export const VIEW_TYPE = 'note-template-sync-editor';

export function createDataEditorView(leaf: WorkspaceLeaf, actions: EditorActions): ItemView {
  return new (class extends ItemView {
    editor = createEditorController(this, actions);

    getViewType(): string {
      return VIEW_TYPE;
    }

    getDisplayText(): string {
      return 'Data editor';
    }

    getIcon(): string {
      return 'sliders-horizontal';
    }

    async onOpen(): Promise<void> {
      await this.editor.render();
    }

    async onClose(): Promise<void> {
      this.editor.dispose();
    }
  })(leaf);
}

export type DataEditorHost = ItemView & {
  editor: ReturnType<typeof createEditorController>;
};
