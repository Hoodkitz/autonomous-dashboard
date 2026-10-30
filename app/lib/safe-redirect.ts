/**
 * Validates client-supplied redirect targets for Stripe Checkout.
 * Only relative paths ("/foo") or absolute URLs on the configured base origin are accepted.
 */
export function resolveSafeRedirect(
  candidate: unknown,
  baseUrl: string,
  fallbackPath: string
): string {
  const base = new URL(baseUrl);
  const fallback = new URL(fallbackPath, base).toString();
  if (typeof candidate !== "string" || candidate.length === 0 || candidate.length > 2048) {
    return fallback;
  }
  // Reject protocol-relative, backslash tricks and control characters.
  if (/^\s*[/\\]{2}/.test(candidate) || /[\\\u0000-\u001f]/.test(candidate)) {
    return fallback;
  }
  try {
    const url = new URL(candidate, base);
    if (url.origin !== base.origin) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}
