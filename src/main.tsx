import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.tsx'
import './index.css'
import { loadUmamiScript } from './utils/analytics'
import { generateErrorFingerprint } from './utils/errorFingerprint'

// Initialize Sentry for error tracking
// Only initialize if DSN is provided (production environment) AND user hasn't explicitly declined
const errorReportingConsent = localStorage.getItem('lenr-error-reporting-consent')
// Default to enabled unless user explicitly declined
if (import.meta.env.VITE_SENTRY_DSN && errorReportingConsent !== 'declined') {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE, // 'development' or 'production'

    // Set release version from build-time environment variable
    release: import.meta.env.VITE_APP_VERSION,

    // Performance monitoring - sample 10% of transactions in production
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 0,

    // Privacy-focused: Filter sensitive data before sending
    beforeSend(event, hint) {
      // Don't send events in development
      if (import.meta.env.MODE === 'development') {
        console.error('[Sentry]', event, hint);
        return null;
      }

      // Add error fingerprint tag for grouping and searching
      if (hint.originalException instanceof Error) {
        const error = hint.originalException;
        const fingerprint = generateErrorFingerprint(error);

        event.tags = {
          ...event.tags,
          errorFingerprint: fingerprint,
        };
      }

      // Remove any query parameters that might contain sensitive data
      if (event.request?.url) {
        try {
          const url = new URL(event.request.url);
          // Keep only safe query params (Z and A for element data)
          const safeParams = ['Z', 'A'];
          const newParams = new URLSearchParams();
          safeParams.forEach(param => {
            const value = url.searchParams.get(param);
            if (value) newParams.set(param, value);
          });
          url.search = newParams.toString();
          event.request.url = url.toString();
        } catch (e) {
          // If URL parsing fails, just use pathname
          event.request.url = event.request.url?.split('?')[0];
        }
      }

      return event;
    },

    // Ignore common non-critical errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      // Network errors that are expected
      'NetworkError',
      'Failed to fetch',
      // ResizeObserver errors (common, non-critical)
      'ResizeObserver loop limit exceeded',
    ],

    // Privacy: Don't capture user IP addresses
    sendDefaultPii: false,

    // React-specific integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Session replay is disabled by default for privacy
        // Only capture replays for errors
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Capture 10% of error sessions for replay
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
  });
}

// Initialize analytics if user has consented
const analyticsConsent = localStorage.getItem('lenr-analytics-consent')
if (analyticsConsent === 'accepted') {
  loadUmamiScript().catch(error => {
    console.error('[Analytics] Failed to load on startup:', error)
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
