export function readDemoMode(search: string): boolean {
  return new URLSearchParams(search).get('mode') === 'demo';
}

export function modeUrl(href: string, demo: boolean): string {
  const url = new URL(href);
  if (demo) url.searchParams.set('mode', 'demo');
  else url.searchParams.delete('mode');
  return `${url.pathname}${url.search}${url.hash}`;
}

export function replaceModeInUrl(demo: boolean): void {
  window.history.replaceState(null, '', modeUrl(window.location.href, demo));
}
