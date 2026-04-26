// Tokens are now managed via httpOnly cookies by the backend.
// This module is kept for API compatibility and may be used for
// non-sensitive settings in the future.

export function clearAuthTokens() {
  // No-op: cookie clearing is handled server-side via logout mutation.
}
