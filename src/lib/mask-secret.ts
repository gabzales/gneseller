/**
 * Masks a secret for display. Short secrets are fully hidden (revealing
 * 4+4 characters of a 9-char secret would leak almost all of it); only
 * long secrets show a short prefix/suffix as a recognisable fingerprint.
 */
export function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length < 16) return "*".repeat(Math.max(secret.length, 4));
  return `${secret.slice(0, 4)}${"*".repeat(Math.max(secret.length - 8, 4))}${secret.slice(-4)}`;
}
