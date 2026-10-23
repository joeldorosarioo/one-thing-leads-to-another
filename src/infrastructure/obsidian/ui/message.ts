export function message(container: HTMLElement, text: string): void {
  container.createEl('p', { text, cls: 'setting-item-description' });
}
