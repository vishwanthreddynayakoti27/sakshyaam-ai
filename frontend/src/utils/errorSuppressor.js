/**
 * Suppress noisy non-actionable error events from React's dev-mode error
 * overlay (`react-error-overlay`). Real errors still:
 *   - log to the browser console
 *   - get POSTed to /api/admin/log-frontend-error via the axios interceptor
 *
 * The overlay was popping `"Script error."` with no useful detail on mobile
 * Chrome — opaque cross-origin error events that the overlay can't unwrap.
 * This prevents officers from interacting with the page even when the app
 * actually rendered fine.
 *
 * NB: react-error-overlay only ships in CRA dev mode. In production builds
 * the import below is dead code and harmless.
 */

// Disable the dev overlay's window-level error listeners.
try {
  // eslint-disable-next-line global-require
  const reo = require('react-error-overlay');
  if (reo && typeof reo.stopReportingRuntimeErrors === 'function') {
    reo.stopReportingRuntimeErrors();
  }
} catch (e) {
  /* package not present in production build — fine */
}

// Belt-and-suspenders: a capture-phase listener that swallows the residual
// "Script error." / ResizeObserver-loop noise so it doesn't reach any other
// global handler that might display it.
const NOISE_PATTERNS = [
  /^Script error\.?$/i,
  /^ResizeObserver loop limit exceeded$/i,
  /^ResizeObserver loop completed with undelivered notifications/i,
];

function isNoise(message) {
  if (!message) return true;
  const m = String(message).trim();
  return NOISE_PATTERNS.some((rx) => rx.test(m));
}

window.addEventListener(
  'error',
  function (event) {
    const hasUseful = event?.error && event.error.stack;
    if (!hasUseful && isNoise(event?.message)) {
      event.stopImmediatePropagation();
      event.preventDefault();
      // eslint-disable-next-line no-console
      console.debug('[suppressed non-actionable error]', event?.message || '(empty)');
      return false;
    }
  },
  true
);

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
