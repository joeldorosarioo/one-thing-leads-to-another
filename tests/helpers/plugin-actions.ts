import type { PluginSettings } from '../../src/application/connections/connection-types';
import { createPluginActions } from '../../src/application/plugin-actions';
import type { VaultPort } from '../../src/application/ports/vault-port';

export function createActions(options: { existingOutput?: string; legacyApproval?: boolean } = {}) {
  const { existingOutput, legacyApproval = false } = options;

  const files = new Map([
    [
      'data.json',
      JSON.stringify({
        schema_version: 1,
        locale: 'en-US',
        currency: 'USD',

        fields: [
          {
            key: 'count',
            label: 'Count',
            section: 'General',
            type: 'number',
            tone: 'none',
            value: 2
          }
        ],

        formulas: []
      })
    ],

    ['template.md', '{{integer:count}}']
  ]);

  if (existingOutput !== undefined) files.set('report.md', existingOutput);
  const saved: PluginSettings[] = [];

  const vault: VaultPort = {
    configDir: '.obsidian',
    getAbstractFileByPath: path => (files.has(path) ? { path, extension: path.split('.').pop() } : null),

    async read(file) {
      return files.get(file.path)!;
    },

    async modify(file, content) {
      files.set(file.path, content);
    },

    async create(path, content) {
      files.set(path, content);
      return { path };
    },

    async createFolder() {}
  };

  const actions = createPluginActions({
    savedSettings: {
      jobs: [
        {
          id: 'test',
          title: 'Test',
          data_path: 'data.json',
          template_path: 'template.md',
          output_path: 'report.md',
          enabled: false,
          overwrite_approved: legacyApproval
        }
      ]
    },

    vault,

    async saveSettings(settings) {
      saved.push(settings);
    },

    notify() {},
    async refreshEditors() {},
    async refreshSync() {}
  });

  return { actions, saved, files, vault };
}
