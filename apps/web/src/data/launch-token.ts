/*
 * The daemon opens the dashboard at `http://127.0.0.1:<port>/#token=<token>` and requires that
 * token on every `/api` request. The token is read once, kept in memory only, and removed from the
 * address bar so it never lands in history, bookmarks, or a copied link. Path-based routing owns
 * the URL from then on; the daemon answers non-`/api` paths with `index.html`.
 */

const TOKEN_KEY = "token";

let launchToken: string | undefined;

export function captureLaunchToken(): void {
  const hash = window.location.hash;

  if (!hash.startsWith("#")) {
    return;
  }

  const params = new URLSearchParams(hash.slice(1));
  const token = params.get(TOKEN_KEY);

  if (token === null || token.length === 0) {
    return;
  }

  launchToken = token;

  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(window.history.state, "", cleanUrl);
}

export function getLaunchToken(): string | undefined {
  return launchToken;
}
