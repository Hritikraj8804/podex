/**
 * Clipboard helpers for the Podex terminals.
 *
 * `navigator.clipboard` requires a secure context (HTTPS or localhost).
 * Podex may be served over plain HTTP in sandboxes (e.g. KodeKloud), so we
 * fall back to the classic hidden-textarea + execCommand('copy') technique.
 */

function fallbackCopy(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.left = '0';
  ta.style.opacity = '0';
  ta.style.pointerEvents = 'none';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

/**
 * Copy text to the system clipboard. Returns a promise resolving to true on
 * success, false on failure.
 */
export function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return Promise.resolve(false);
  try {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard
        .writeText(text)
        .then(() => true)
        .catch(() => fallbackCopy(text));
    }
  } catch {
    // navigator.clipboard may be undefined
  }
  return Promise.resolve(fallbackCopy(text));
}

/**
 * Read text from the system clipboard (used for Ctrl+Shift+V paste).
 * Falls back to null when unavailable or permission is denied — in that case
 * the caller should let the browser's native paste handler take over.
 */
export async function readClipboard(): Promise<string | null> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      return await navigator.clipboard.readText();
    }
  } catch {
    // Permission denied or not supported
  }
  return null;
}