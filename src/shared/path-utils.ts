export function normalizePath(input: string, configDir?: string): string {
  if (typeof input !== 'string') throw new Error('File path is required.');
  const path = input.trim().replace(/\\/g, '/').replace(/\/+/g, '/');

  if (!path || path.startsWith('/') || path.endsWith('/')) {
    throw new Error('Use a file path relative to your vault.');
  }

  if (path.split('/').some(part => part === '.' || part === '..' || !part)) {
    throw new Error('Path traversal is not allowed.');
  }

  if (configDir && (path === configDir || path.startsWith(configDir + '/'))) {
    throw new Error('Do not store document files in the vault configuration folder.');
  }

  return path;
}
export function relocatePath(path: string, oldPath: string, newPath: string): string {
  if (path === oldPath) return newPath;
  if (path.startsWith(oldPath + '/')) return newPath + path.slice(oldPath.length);

  return path;
}
