/**
 * PKCE (Proof Key for Code Exchange) utility functions
 * Implements RFC 7636 for enhanced OAuth 2.0 security
 */

/**
 * Generates a cryptographically random code verifier
 * @returns Base64URL encoded string (43-128 characters)
 */
export function generateCodeVerifier(): string {
  // Generate 32 random bytes and encode as base64url
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

/**
 * Creates a code challenge from code verifier using SHA256
 * @param verifier The code verifier
 * @returns Base64URL encoded SHA256 hash
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(digest));
}

/**
 * Stores code verifier in session storage
 * @param verifier The code verifier to store
 */
export function storeCodeVerifier(verifier: string): void {
  sessionStorage.setItem('pkce_code_verifier', verifier);
}

/**
 * Retrieves code verifier from session storage
 * @returns The stored code verifier or null if not found
 */
export function getCodeVerifier(): string | null {
  return sessionStorage.getItem('pkce_code_verifier');
}

/**
 * Clears code verifier from session storage
 */
export function clearCodeVerifier(): void {
  sessionStorage.removeItem('pkce_code_verifier');
}

/**
 * Generates a random state parameter for CSRF protection
 * @returns Base64URL encoded random string
 */
export function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

/**
 * Stores state parameter in session storage
 * @param state The state parameter to store
 */
export function storeState(state: string): void {
  sessionStorage.setItem('oauth_state', state);
}

/**
 * Retrieves and validates state parameter
 * @param receivedState The state parameter received from OAuth provider
 * @returns True if state is valid, false otherwise
 */
export function validateState(receivedState: string): boolean {
  const storedState = sessionStorage.getItem('oauth_state');
  sessionStorage.removeItem('oauth_state');
  return storedState === receivedState;
}

/**
 * Base64URL encoding function (RFC 4648)
 * @param buffer The buffer to encode
 * @returns Base64URL encoded string
 */
function base64URLEncode(buffer: Uint8Array): string {
  // Преобразуем Uint8Array в строку без spread оператора для совместимости
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  
  const base64 = btoa(binary);
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
