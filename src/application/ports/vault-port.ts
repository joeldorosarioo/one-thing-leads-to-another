export interface VaultFile {
  path: string;
  extension?: string;
}

export interface VaultPort {
  readonly configDir: string;
  getAbstractFileByPath(path: string): VaultFile | null;
  read(file: VaultFile): Promise<string>;
  modify(file: VaultFile, content: string): Promise<void>;
  create(path: string, content: string): Promise<VaultFile>;
  createFolder(path: string): Promise<unknown>;
}

export function isVaultFile(value: VaultFile | null): value is VaultFile {
  return Boolean(value && typeof value.extension === 'string');
}
