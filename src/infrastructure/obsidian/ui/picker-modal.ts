import { FuzzySuggestModal, type App, type TFile } from 'obsidian';

function createPicker<T>(
  app: App,
  placeholder: string,
  items: () => T[],
  label: (item: T) => string,
  choose: (item: T) => void
) {
  const modal = new (class extends FuzzySuggestModal<T> {
    getItems(): T[] {
      return items();
    }

    getItemText(item: T): string {
      return label(item);
    }

    onChooseItem(item: T): void {
      choose(item);
    }
  })(app);

  modal.setPlaceholder(placeholder);
  return modal;
}

export function createFilePicker(app: App, extension: string, choose: (path: string) => void) {
  const placeholder = `Choose ${extension} file`;

  function getMatchingFiles(): TFile[] {
    const files = app.vault.getFiles();
    return files.filter(file => file.extension.toLowerCase() === extension);
  }

  function getFilePath(file: TFile): string {
    return file.path;
  }

  function handleFileSelection(file: TFile): void {
    choose(file.path);
  }

  return createPicker<TFile>(app, placeholder, getMatchingFiles, getFilePath, handleFileSelection);
}

export function createOptionPicker(
  app: App,
  placeholder: string,
  options: [string, string][],
  choose: (value: string) => void
) {
  return createPicker(
    app,
    placeholder,
    () => options,
    item => item[1],
    item => choose(item[0])
  );
}
