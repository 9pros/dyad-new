import { ipcMain, IpcMainInvokeEvent } from "electron";
import log from "electron-log";
import { createLoggedHandler } from "./safe_handle";

const logger = log.scope("qwen_oauth_handlers");
const handle = createLoggedHandler(logger);

// Qwen OAuth endpoints from the .md file
const QWEN_DEVICE_CODE_URL = "https://chat.qwen.ai/api/v1/oauth2/device/code";
const QWEN_TOKEN_URL = "https://chat.qwen.ai/api/v1/oauth2/token";
const QWEN_CLIENT_ID = "f0304373b74a44d2b584a3fb70ca9e56";
const QWEN_SCOPE = "openid profile email model.completion";

/**
 * Generate a random code verifier for PKCE
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate code challenge from verifier using SHA-256
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export interface QwenDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export interface QwenTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
  resource_url?: string;
}

/**
 * Request device code from Qwen OAuth endpoint
 */
handle(
  "qwen-oauth:device-code",
  async (): Promise<QwenDeviceCodeResponse> => {
    try {
      // Generate PKCE code verifier and challenge
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      const response = await fetch(QWEN_DEVICE_CODE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: QWEN_CLIENT_ID,
          scope: QWEN_SCOPE,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
        }),
      });

      if (!response.ok) {
        throw new Error(`Device code request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Store the code verifier for later token exchange
      // We'll need to return it so the frontend can use it for token polling
      return {
        ...data,
        code_verifier: codeVerifier, // Include this for token exchange
      };
    } catch (error) {
      logger.error("Failed to get Qwen device code:", error);
      throw new Error(`Failed to get Qwen device code: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
);

/**
 * Poll for token using device code
 */
handle(
  "qwen-oauth:token",
  async (
    event: IpcMainInvokeEvent,
    params: {
      deviceCode: string;
      codeVerifier: string;
    },
  ): Promise<QwenTokenResponse> => {
    try {
      const { deviceCode, codeVerifier } = params;

      const response = await fetch(QWEN_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          client_id: QWEN_CLIENT_ID,
          device_code: deviceCode,
          code_verifier: codeVerifier,
        }),
      });

      if (!response.ok) {
        if (response.status === 400) {
          const errorData = await response.json();
          // Return the error data so frontend can handle polling
          throw errorData;
        }
        throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error("Failed to get Qwen token:", error);
      throw error;
    }
  },
);

/**
 * Register all Qwen OAuth handlers
 */
export function registerQwenOAuthHandlers() {
  // Handlers are already registered above via the handle() calls
}
