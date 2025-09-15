/**
 * Enhanced Authentication Service with PKCE support
 * Implements OAuth 2.0 Authorization Code Flow with PKCE (RFC 7636)
 */

import { 
  generateCodeVerifier, 
  generateCodeChallenge, 
  storeCodeVerifier, 
  getCodeVerifier, 
  clearCodeVerifier,
  generateState,
  storeState,
  validateState 
} from '../utils/pkce';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface AuthConfig {
  keycloakUrl: string;
  realm: string;
  clientId: string;
  redirectUri: string;
}

export class AuthService {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Initiates OAuth 2.0 Authorization Code Flow with PKCE
   */
  async initiateLogin(): Promise<void> {
    try {
      // Generate PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateState();

      // Store parameters for later use
      storeCodeVerifier(codeVerifier);
      storeState(state);

      // Build authorization URL with PKCE parameters
      const authUrl = this.buildAuthorizationUrl(codeChallenge, state);

      // Redirect user to Keycloak
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to initiate login:', error);
      throw new Error('Authentication initialization failed');
    }
  }

  /**
   * Handles the authorization callback and exchanges code for tokens
   */
  async handleCallback(code: string, state: string): Promise<TokenResponse> {
    try {
      // Validate state parameter (CSRF protection)
      if (!validateState(state)) {
        throw new Error('Invalid state parameter - possible CSRF attack');
      }

      // Get stored code verifier
      const codeVerifier = getCodeVerifier();
      if (!codeVerifier) {
        throw new Error('Code verifier not found - authentication flow corrupted');
      }

      // Exchange authorization code for tokens
      const tokens = await this.exchangeCodeForTokens(code, codeVerifier);

      // Clean up stored parameters
      clearCodeVerifier();

      return tokens;
    } catch (error) {
      // Clean up on error
      clearCodeVerifier();
      console.error('Callback handling failed:', error);
      throw error;
    }
  }

  /**
   * Builds the authorization URL with PKCE parameters
   */
  private buildAuthorizationUrl(codeChallenge: string, state: string): string {
    const baseUrl = `${this.config.keycloakUrl}/realms/${this.config.realm}/protocol/openid-connect/auth`;
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'openid profile email',  // Возвращаем полные scopes для получения информации о пользователе
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: state,
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for access tokens using PKCE
   */
  private async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TokenResponse> {
    const tokenUrl = `${this.config.keycloakUrl}/realms/${this.config.realm}/protocol/openid-connect/token`;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      code: code,
      redirect_uri: this.config.redirectUri,
      code_verifier: codeVerifier, // PKCE parameter
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token exchange failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const tokens = await response.json();
    console.log('Token exchange successful:', {
      access_token: tokens.access_token ? 'present' : 'missing',
      id_token: tokens.id_token ? 'present' : 'missing', 
      refresh_token: tokens.refresh_token ? 'present' : 'missing',
      token_type: tokens.token_type,
      expires_in: tokens.expires_in
    });
    
    return tokens;
  }

  /**
   * Refreshes access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const tokenUrl = `${this.config.keycloakUrl}/realms/${this.config.realm}/protocol/openid-connect/token`;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      refresh_token: refreshToken,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    return await response.json();
  }

  /**
   * Logs out the user by redirecting to Keycloak logout endpoint
   */
  async logout(idToken?: string, postLogoutRedirectUri?: string): Promise<void> {
    const logoutUrl = `${this.config.keycloakUrl}/realms/${this.config.realm}/protocol/openid-connect/logout`;
    
    const params = new URLSearchParams();
    if (idToken) {
      params.set('id_token_hint', idToken);
    }
    if (postLogoutRedirectUri) {
      params.set('post_logout_redirect_uri', postLogoutRedirectUri);
    }

    const fullLogoutUrl = params.toString() 
      ? `${logoutUrl}?${params.toString()}`
      : logoutUrl;

    window.location.href = fullLogoutUrl;
  }
}

// Default configuration for BionicPRO
export const createBionicProAuthService = () => {
  const config: AuthConfig = {
    keycloakUrl: process.env.REACT_APP_KEYCLOAK_URL || 'http://localhost:8080',
    realm: 'bionicpro',
    clientId: process.env.REACT_APP_CLIENT_ID || 'bionicpro-web-shop',
    redirectUri: process.env.REACT_APP_REDIRECT_URI || `${window.location.origin}/auth/callback`,
  };

  return new AuthService(config);
};
