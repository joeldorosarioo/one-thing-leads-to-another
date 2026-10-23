export function normalizePath(input: string): string {
  if (typeof input !== 'string') throw new Error('File path is required.');
  const path = input.trim().replace(/\\/g, '/').replace(/\/+/g, '/');

  if (!path || path.startsWith('/') || path.endsWith('/')) {
    throw new Error('Use a file path relative to your vault.');
  }

  if (path.split('/').some(part => part === '.' || part === '..' || !part)) {
    throw new Error('Path traversal is not allowed.');
  }

  if (path.split('/')[0] === '.obsidian') {
    throw new Error('Do not store document files in the .obsidian configuration folder.');
  }

  return path;
}
export function relocatePath(path: string, oldPath: string, newPath: string): string {
  if (path === oldPath) return newPath;
  if (path.startsWith(oldPath + '/')) return newPath + path.slice(oldPath.length);

  return path;
}
