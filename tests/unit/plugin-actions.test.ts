import { describe, expect, it } from 'vitest';
import { createActions } from '../helpers/plugin-actions';

describe('plugin application actions', () => {
  it('rejects connections inside the configured vault settings folder before creating files', async () => {
    const { actions, vault, files } = createActions();
    Object.assign(vault, { configDir: 'config/private' });
    const original = [...files];

    await expect(
      actions.saveConnection(
        {
          id: 'unsafe',
          title: 'Unsafe',
          enabled: false,
          data_path: 'config/private/data.json',
          template_path: 'template.md',
          output_path: 'unsafe.md'
        },
        { create: true }
      )
    ).rejects.toThrow(/configuration folder/);

    expect([...files]).toEqual(original);
    expect(actions.listConnections()).toHaveLength(1);
    actions.dispose();
  });

  it('allows an ordinary folder named .obsidian when the vault uses another config folder', async () => {
    const { actions, vault, files } = createActions();
    Object.assign(vault, { configDir: 'config/private' });
    await actions.saveConnection(
      {
        id: 'ordinary',
        title: 'Ordinary',
        enabled: false,
        data_path: '.obsidian/data.json',
        template_path: 'template.md',
        output_path: 'ordinary.md'
      },
      { create: true }
    );
    expect(files.has('.obsidian/data.json')).toBe(true);
    actions.dispose();
  });

  it('does not rewrite the source when saving unchanged regional settings', async () => {
    const { actions, files } = createActions();
    const original = files.get('data.json');

    await actions.saveConnection(
      {
        ...actions.listConnections()[0],
        title: 'Renamed'
      },
      {
        format: {
          locale: 'en-US',
          currency: 'USD'
        }
      }
    );

    expect(files.get('data.json')).toBe(original);
    actions.dispose();
  });

  it('allows regional settings to repair an invalid locale in an existing document', async () => {
    const { actions, files } = createActions();
    const document = JSON.parse(files.get('data.json')!);

    document.locale = 'not-a-locale!';
    files.set('data.json', JSON.stringify(document));

    await actions.saveConnection(actions.listConnections()[0], { format: { locale: 'pt-BR', currency: 'BRL' } });

    expect(JSON.parse(files.get('data.json')!).locale).toBe('pt-BR');
    actions.dispose();
  });

  it('does not write settings again when syncing an unchanged report', async () => {
    const { actions, saved } = createActions();
    await actions.syncConnection('test');

    expect(saved).toHaveLength(1);
    await actions.syncConnection('test');

    expect(saved).toHaveLength(1);
    actions.dispose();
  });

  it('requires request-level approval even if legacy settings contain an approval flag', async () => {
    const { actions, files } = createActions({ existingOutput: 'Manual edits', legacyApproval: true });

    expect(await actions.syncConnection('test')).toBe('conflict');
    expect(files.get('report.md')).toBe('Manual edits');

    actions.dispose();
  });

  it('limits overwrite approval to one request and never persists it', async () => {
    const { actions, saved, files } = createActions({ existingOutput: 'Manual edits' });
    await actions.syncConnection('test', { overwriteApproved: true });

    expect(files.get('report.md')).toBe('2');
    expect(saved[0].jobs[0]).not.toHaveProperty('overwrite_approved');

    files.set('report.md', 'Another manual edit');

    expect(await actions.syncConnection('test')).toBe('conflict');
    expect(files.get('report.md')).toBe('Another manual edit');

    actions.dispose();
  });

  it('runs a manual sync requested while an earlier generation is still reading', async () => {
    const { actions, files, vault } = createActions();
    const originalRead = vault.read;

    let releaseRead!: () => void;
    let signalRead!: () => void;

    const started = new Promise<void>(resolve => {
      signalRead = resolve;
    });

    const paused = new Promise<void>(resolve => {
      releaseRead = resolve;
    });

    let firstRead = true;

    vault.read = async file => {
      const snapshot = await originalRead(file);

      if (file.path === 'data.json' && firstRead) {
        firstRead = false;
        signalRead();
        await paused;
      }

      return snapshot;
    };

    const first = actions.syncConnection('test');
    await started;

    const document = JSON.parse(files.get('data.json')!);
    document.fields[0].value = 3;
    files.set('data.json', JSON.stringify(document));

    const second = actions.syncConnection('test');
    releaseRead();
    await Promise.all([first, second]);

    expect(files.get('report.md')).toBe('3');
    actions.dispose();
  });
});
