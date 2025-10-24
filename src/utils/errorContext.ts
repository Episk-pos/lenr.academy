/**
 * Error context collection utilities
 * Gathers browser, OS, device, and application information for error reporting
 */

import { generateErrorFingerprint } from './errorFingerprint';

export interface ErrorContext {
  error: Error;
  errorBoundary: string;
  timestamp: string;
  url: string;
  userAgent: string;
  browser: string;
  browserVersion: string;
  os: string;
  device: 'Desktop' | 'Mobile' | 'Tablet';
  appVersion: string;
  fingerprint: string;
  stackTrace: string;
}

/**
 * Detect browser name and version from User-Agent string
 */
function detectBrowser(userAgent: string): { name: string; version: string } {
  const ua = userAgent.toLowerCase();

  // Edge (must check before Chrome)
  if (ua.includes('edg/')) {
    const match = ua.match(/edg\/([0-9.]+)/);
    return { name: 'Edge', version: match ? match[1] : 'Unknown' };
  }

  // Chrome
  if (ua.includes('chrome/') && !ua.includes('edg/')) {
    const match = ua.match(/chrome\/([0-9.]+)/);
    return { name: 'Chrome', version: match ? match[1] : 'Unknown' };
  }

  // Firefox
  if (ua.includes('firefox/')) {
    const match = ua.match(/firefox\/([0-9.]+)/);
    return { name: 'Firefox', version: match ? match[1] : 'Unknown' };
  }

  // Safari (must check after Chrome/Edge)
  if (ua.includes('safari/') && !ua.includes('chrome/')) {
    const match = ua.match(/version\/([0-9.]+)/);
    return { name: 'Safari', version: match ? match[1] : 'Unknown' };
  }

  // Opera
  if (ua.includes('opr/') || ua.includes('opera/')) {
    const match = ua.match(/(?:opr|opera)\/([0-9.]+)/);
    return { name: 'Opera', version: match ? match[1] : 'Unknown' };
  }

  return { name: 'Unknown', version: 'Unknown' };
}

/**
 * Detect operating system from User-Agent string
 */
function detectOS(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  if (ua.includes('win')) return 'Windows';
  if (ua.includes('mac')) return 'macOS';
  if (ua.includes('linux')) return 'Linux';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS';

  return 'Unknown';
}

/**
 * Detect device type based on screen width and touch support
 */
function detectDevice(): 'Desktop' | 'Mobile' | 'Tablet' {
  const width = window.innerWidth;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (!hasTouch) return 'Desktop';

  // Mobile: < 768px with touch
  if (width < 768) return 'Mobile';

  // Tablet: >= 768px with touch
  return 'Tablet';
}

/**
 * Format stack trace for display
 * Removes noise and highlights important information
 */
function formatStackTrace(error: Error): string {
  if (!error.stack) {
    return 'No stack trace available';
  }

  // Return the stack trace as-is, but remove the error message from the first line
  // (since we display it separately)
  const lines = error.stack.split('\n');

  // If first line contains the error message, skip it
  if (lines[0] && lines[0].includes(error.message)) {
    return lines.slice(1).join('\n').trim();
  }

  return error.stack.trim();
}

/**
 * Collect comprehensive error context for reporting
 *
 * @param error - The error object
 * @param errorBoundary - Name/location of the error boundary that caught the error
 * @returns Complete error context with all diagnostic information
 */
export function collectErrorContext(error: Error, errorBoundary = 'Unknown'): ErrorContext {
  const userAgent = navigator.userAgent;
  const browser = detectBrowser(userAgent);
  const timestamp = new Date().toISOString();
  const url = window.location.href;
  const appVersion = import.meta.env.VITE_APP_VERSION || 'unknown';
  const fingerprint = generateErrorFingerprint(error);
  const stackTrace = formatStackTrace(error);

  return {
    error,
    errorBoundary,
    timestamp,
    url,
    userAgent,
    browser: browser.name,
    browserVersion: browser.version,
    os: detectOS(userAgent),
    device: detectDevice(),
    appVersion,
    fingerprint,
    stackTrace,
  };
}
