/**
 * Error fingerprinting utility for grouping similar errors
 * Generates an 8-character hash from error type and message
 */

/**
 * Simple string hash function that generates a consistent hash
 * Based on djb2 algorithm - fast and provides good distribution
 */
function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Convert number to base-36 string (0-9, a-z) for compact representation
 */
function toBase36(num: number): string {
  return num.toString(36);
}

/**
 * Generate an 8-character fingerprint for an error
 * The fingerprint is based on the error type and the first 120 characters of the message
 * This allows grouping of similar errors while keeping the fingerprint short
 *
 * @param error - The error object to fingerprint
 * @returns An 8-character fingerprint string (lowercase alphanumeric)
 *
 * @example
 * const error = new TypeError('Cannot read property "foo" of undefined')
 * const fingerprint = generateErrorFingerprint(error)
 * // Returns something like: "a1b2c3d4"
 */
export function generateErrorFingerprint(error: Error): string {
  // Normalize the error message: take first 120 chars, lowercase, remove extra whitespace
  const normalizedMessage = error.message
    .substring(0, 120)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  // Create input string: error type + normalized message
  const input = `${error.name}:${normalizedMessage}`;

  // Generate hash
  const hash = simpleHash(input);

  // Convert to base-36 and pad/truncate to 8 characters
  const fingerprint = toBase36(hash).padStart(8, '0').substring(0, 8);

  return fingerprint;
}

/**
 * Validate that a fingerprint matches the expected format
 * Expected format: 8 lowercase alphanumeric characters
 */
export function isValidFingerprint(fingerprint: string): boolean {
  return /^[0-9a-z]{8}$/.test(fingerprint);
}
