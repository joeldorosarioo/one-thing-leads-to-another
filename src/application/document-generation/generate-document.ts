import { blankDocument, parseDocument } from '../../domain/data-model';
import { renderTemplate } from '../../domain/template-renderer';
import { errorMessage } from '../../shared/error-message';
import { validateConnection, type ConnectionPaths } from '../connections/connection-paths';
import { isVaultFile, type VaultPort } from '../ports/vault-port';

export interface DocumentInspection {
  status: 'created' | 'updated' | 'unchanged';
  output: string;
  existing: string | null;
}

export async function ensureFolders(vault: VaultPort, path: string): Promise<void> {
  const parts = path.split('/');
  parts.pop();

  let parent = '';

  for (const part of parts) {
    parent = parent ? `${parent}/${part}` : part;
    if (!vault.getAbstractFileByPath(parent)) await vault.createFolder(parent);
  }
}

export async function createStarterFiles(vault: VaultPort, connection: ConnectionPaths): Promise<void> {
  validateConnection(connection, vault.configDir);

  if (!vault.getAbstractFileByPath(connection.data_path)) {
    await ensureFolders(vault, connection.data_path);
    await vault.create(connection.data_path, JSON.stringify(blankDocument(), null, 2) + '\n');
  }

  if (!vault.getAbstractFileByPath(connection.template_path)) {
    await ensureFolders(vault, connection.template_path);

    await vault.create(
      connection.template_path,
      '# {{text:document_title}}\n\nEdit this template to add content and placeholders.\n'
    );
  }
}

export async function inspectDocument(vault: VaultPort, connection: ConnectionPaths): Promise<DocumentInspection> {
  validateConnection(connection, vault.configDir);

  const source = vault.getAbstractFileByPath(connection.data_path);
  const template = vault.getAbstractFileByPath(connection.template_path);

  if (!isVaultFile(source) || !isVaultFile(template)) {
    throw new Error('Data source or template not found. Check the configured paths.');
  }

  const [dataText, templateText] = await Promise.all([vault.read(source), vault.read(template)]);

  let input: unknown;

  try {
    input = JSON.parse(dataText);
  } catch (error) {
    throw new Error(`Invalid JSON data: ${errorMessage(error)}`);
  }

  const output = renderTemplate(templateText, parseDocument(input));
  const file = vault.getAbstractFileByPath(connection.output_path);
  if (file && !isVaultFile(file)) throw new Error('Output path is a folder, not a file.');

  const existing = file ? await vault.read(file) : null;

  return {
    output,
    existing,
    status: existing === null ? 'created' : existing === output ? 'unchanged' : 'updated'
  };
}

export async function writeDocument(
  vault: VaultPort,
  connection: ConnectionPaths,
  inspection: DocumentInspection,
  mayWrite: () => boolean = () => true
): Promise<'created' | 'updated' | 'unchanged' | 'cancelled'> {
  const { status, output } = inspection;

  if (status === 'unchanged') return status;
  if (!mayWrite()) return 'cancelled';

  if (status === 'updated') {
    const file = vault.getAbstractFileByPath(connection.output_path);
    if (!isVaultFile(file)) throw new Error('Output path is not a file.');
    await vault.modify(file, output);
  } else {
    await ensureFolders(vault, connection.output_path);
    if (!mayWrite()) return 'cancelled';
    await vault.create(connection.output_path, output);
  }

  return status;
}

export async function generateDocument(
  vault: VaultPort,
  connection: ConnectionPaths,
  mayWrite: () => boolean = () => true
): Promise<'created' | 'updated' | 'unchanged' | 'cancelled'> {
  return writeDocument(vault, connection, await inspectDocument(vault, connection), mayWrite);
}
