import { Setting, type App, type DropdownComponent } from 'obsidian';
import type { FormatDraft } from '../../application/connections/connection-types';
import type { ConnectionActions } from '../../application/plugin-actions';
import { availableCurrencies, availableLocales, previewFormat, recommendedCurrency } from '../../domain/format-options';
import { message } from '../../infrastructure/obsidian/ui/message';
import { createOptionPicker } from '../../infrastructure/obsidian/ui/picker-modal';

export function createRegionalSettings(app: App, readFormats: ConnectionActions['readFormats']) {
  const state = {
    formatDraft: null as FormatDraft | null,
    currencyTouched: false,
    localeDropdown: null as DropdownComponent | null,
    currencyDropdown: null as DropdownComponent | null,
    previewEl: null as HTMLElement | null
  };

  function getFormats(): FormatDraft {
    return (state.formatDraft ??= { locale: 'en-US', currency: 'USD' });
  }

  function render(root: HTMLElement): void {
    root.createEl('h3', {
      text: 'Regional settings',
      cls: 'nts-settings-heading'
    });

    message(root, 'These settings are saved in the source JSON, keeping your data portable.');
    renderLocale(root);
    renderCurrency(root);

    const preview = root.createDiv({
      cls: 'nts-format-preview'
    });

    preview.createEl('span', {
      text: 'Formatting preview',
      cls: 'nts-preview-label'
    });

    state.previewEl = preview.createEl('strong');
    refreshPreview();
  }

  function renderLocale(root: HTMLElement): void {
    const localeSetting = new Setting(root).setName('Locale').setDesc('Language and region used to format numbers.');

    localeSetting.addDropdown(dropdown => {
      state.localeDropdown = dropdown;

      for (const [value, label] of availableLocales(getFormats().locale))
        dropdown.addOption(value, `${label} — ${value}`);

      dropdown.setValue(getFormats().locale).onChange(changeLocale);
    });

    localeSetting.addExtraButton(button =>
      button
        .setIcon('search')
        .setTooltip('Search locales')
        .onClick(() =>
          createOptionPicker(
            app,
            'Search locale',
            availableLocales(getFormats().locale).map(([tag, label]) => [tag, `${label} — ${tag}`]),
            value => {
              state.localeDropdown?.setValue(value);
              changeLocale(value);
            }
          ).open()
        )
    );
  }

  function renderCurrency(root: HTMLElement): void {
    const currencySetting = new Setting(root).setName('Currency').setDesc('ISO 4217 code used for currency values.');

    currencySetting.addDropdown(dropdown => {
      state.currencyDropdown = dropdown;
      for (const [value, label] of availableCurrencies(getFormats().currency)) dropdown.addOption(value, label);
      dropdown.setValue(getFormats().currency).onChange(changeCurrency);
    });

    currencySetting.addExtraButton(button =>
      button
        .setIcon('search')
        .setTooltip('Search currencies')
        .onClick(() =>
          createOptionPicker(app, 'Search currency name or code', availableCurrencies(getFormats().currency), value => {
            state.currencyDropdown?.setValue(value);
            changeCurrency(value);
          }).open()
        )
    );
  }

  function changeLocale(value: string): void {
    const formats = getFormats();
    const previousCurrency = recommendedCurrency(formats.locale);

    formats.locale = value;
    const suggestion = recommendedCurrency(value);

    if (!state.currencyTouched && suggestion && formats.currency === previousCurrency) {
      formats.currency = suggestion;
      state.currencyDropdown?.setValue(suggestion);
    }

    refreshPreview();
  }

  function changeCurrency(value: string): void {
    state.currencyTouched = true;
    getFormats().currency = value;
    refreshPreview();
  }

  function refreshPreview(): void {
    if (!state.previewEl) return;

    try {
      state.previewEl.setText(previewFormat(getFormats().locale, getFormats().currency));
    } catch (_) {
      state.previewEl.setText('Invalid locale or currency');
    }
  }

  return {
    render,
    getDraft: () => state.formatDraft,

    async load(path: string): Promise<void> {
      state.formatDraft ??= await readFormats(path);
    },

    reset() {
      state.formatDraft = null;
    },

    validate() {
      const { locale, currency } = getFormats();
      previewFormat(locale, currency);
    }
  };
}
