export function randomId(): string {
  return 'doc_' + Math.random().toString(36).slice(2, 11);
}
