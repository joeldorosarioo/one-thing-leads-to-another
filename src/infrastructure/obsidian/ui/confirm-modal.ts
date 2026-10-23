import { Modal, Notice, requireApiVersion, Setting, type App } from 'obsidian';
import { errorMessage } from '../../../shared/error-message';

export function createConfirmModal(
  app: App,
  title: string,
  description: string,
  confirmText: string,
  action: () => void | Promise<void>
) {
  const modal = new Modal(app);

  modal.onOpen = () => {
    modal.titleEl.setText(title);

    modal.contentEl.createEl('p', {
      text: description,
      cls: 'setting-item-description'
    });

    new Setting(modal.contentEl)
      .addButton(button => button.setButtonText('Cancel').onClick(() => modal.close()))
      .addButton(button => {
        button.setButtonText(confirmText);

        if (requireApiVersion('1.13.0')) {
          button.setDestructive().setCta();
        } else {
          button.buttonEl.addClass('mod-warning');
        }

        button.onClick(async () => {
          modal.close();

          try {
            await action();
          } catch (error) {
            new Notice(errorMessage(error), 8000);
          }
        });
      });
  };

  modal.onClose = () => modal.contentEl.empty();
  return modal;
}
