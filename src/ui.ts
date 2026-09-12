export const animalArt = (category: string): string =>
  ({ Cat: 'cat', Dog: 'dog', Bird: 'bird', Pigeon: 'bird', Budgie: 'bird', Fox: 'fox' })[
    category
  ] ?? 'paw';
export const escape = (s: unknown): string =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export const count = (n: number): string => n.toLocaleString('en-GB');
export function asset(path: string): string {
  return new URL(import.meta.env.BASE_URL + path, document.baseURI).href;
}
export function icon(name: string): string {
  const paths: Record<string, string> = {
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    pin: '<path d="M20 9c0 6-8 13-8 13S4 15 4 9a8 8 0 1 1 16 0Z"/><circle cx="12" cy="9" r="2"/>',
    book: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 3v18m3-13h5m-5 4h5"/>',
    share:
      '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 11 6-4m-6 6 6 4"/>',
    filter:
      '<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3" transform="rotate(-15 12 12)"/><path d="m8 8 .01 0m8 0 .01 0m-4 4 .01 0m-4 4 .01 0m8 0 .01 0" stroke-width="3"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    list: '<path d="M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  };
  return `<svg aria-hidden="true" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] ?? paths.pin}</svg>`;
}
