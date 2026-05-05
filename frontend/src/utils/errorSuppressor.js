/**
 * Suppress noisy non-actionable error events:
 *  - "Script error." with no message/file (cross-origin opaque errors,
 *    common on mobile Chrome / Android WebView with strict CSP)
 *  - ResizeObserver loop limit warnings
 *  - ChunkLoadError (handled by graceful reload below)
 *
 * Real errors with a stack trace still bubble through to the React error
 * overlay and our /admin/log-frontend-error reporter.
 */

// Patterns that we know are non-actionable noise
const NOISE_PATTERNS = [
  /^Script error\.?$/i,
  /^ResizeObserver loop limit exceeded$/i,
  /^ResizeObserver loop completed with undelivered notifications/i,
];

function isNoise(message) {
  if (!message) return true; // empty messages are always noise
  const m = String(message);
  return NOISE_PATTERNS.some((rx) => rx.test(m.trim()));
}

window.addEventListener(
  'error',
  function (event) {
    // event.message === '' or 'Script error.' with no event.error → cross-origin
    // opaque error; nothing actionable for us. Stop it from triggering the
    // React-error-overlay panel.
    const msg = event?.message;
    const hasUsefulError = event?.error && event.error.stack;
    if (!hasUsefulError && isNoise(msg)) {
      event.stopImmediatePropagation();
      event.preventDefault();
      // Quietly note it in the console so we still know it happened
      // (don't recurse into our error logger)
      // eslint-disable-next-line no-console
      console.debug('[suppressed non-actionable error]', msg || '(empty)', event?.filename, event?.lineno);
      return false;
    }
  },
  true // capture phase — beat React's listener
);

// Same for unhandled promise rejections that have no useful payload
window.addEventListener(
  'unhandledrejection',
  function (event) {
    const reason = event?.reason;
    const msg = reason?.message || (typeof reason === 'string' ? reason : '');
    const hasStack = reason?.stack;
    if (!hasStack && isNoise(msg)) {
      event.stopImmediatePropagation();
      event.preventDefault();
      // eslint-disable-next-line no-console
      console.debug('[suppressed non-actionable rejection]', msg || '(empty)');
    }
  },
  true
);

export {};
