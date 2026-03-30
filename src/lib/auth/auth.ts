import { generatePKCE } from "@openauthjs/openauth/pkce"

import {
  DEFAULT_QWEN_BASE_URL,
  PROVIDER_ID,
  QWEN_OAUTH,
  TOKEN_REFRESH_BUFFER_MS,
  VERIFICATION_URI,
} from "../constants.js"
import { LOGGING_ENABLED, logError, logInfo, logWarn } from "../logger.js"
import type {
  Auth,
  DeviceAuthorizationResponse,
  OAuth,
  PKCEPair,
  QwenTokenResponse,
  TokenResult,
} from "../types.js"

type AuthClient = {
  auth: {
    set(options: {
      path: { id: string }
      body: OAuth
    }): Promise<unknown>
  }
}

function normalizeResourceUrl(resourceUrl?: string): string | undefined {
  if (!resourceUrl) return undefined

  try {
    let normalizedUrl = resourceUrl
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = `https://${normalizedUrl}`
    }

    new URL(normalizedUrl)

    if (LOGGING_ENABLED) {
      logInfo("Valid resource_url found and normalized:", normalizedUrl)
    }

    return normalizedUrl
  } catch (error) {
    logWarn("invalid resource_url:", { original: resourceUrl, error })
    return undefined
  }
}

function validateTokenResponse(
  json: Partial<QwenTokenResponse>,
  context: string,
): json is QwenTokenResponse {
  if (!json.access_token || !json.refresh_token || typeof json.expires_in !== "number") {
    logError(`${context} missing fields:`, json)
    return false
  }

  if (json.expires_in <= 0) {
    logError(`invalid expires_in value in ${context}:`, json.expires_in)
    return false
  }

  return true
}

export async function requestDeviceCode(
  pkce: PKCEPair,
): Promise<DeviceAuthorizationResponse | null> {
  try {
    const res = await fetch(QWEN_OAUTH.DEVICE_CODE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: QWEN_OAUTH.CLIENT_ID,
        scope: QWEN_OAUTH.SCOPE,
        code_challenge: pkce.challenge,
        code_challenge_method: "S256",
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      logError("device code request failed:", { status: res.status, text })
      return null
    }

    const json = (await res.json()) as Partial<DeviceAuthorizationResponse>

    if (LOGGING_ENABLED) {
      logInfo("Device code response received:", json)
    }

    if (!json.device_code || !json.user_code || !json.verification_uri) {
      logError("device code response missing fields:", json)
      return null
    }

    if (
      !json.verification_uri_complete ||
      !json.verification_uri_complete.includes(VERIFICATION_URI.CLIENT_PARAM_KEY)
    ) {
      const baseUrl = json.verification_uri_complete || json.verification_uri
      const separator = baseUrl.includes("?") ? "&" : "?"
      json.verification_uri_complete = `${baseUrl}${separator}${VERIFICATION_URI.CLIENT_PARAM_VALUE}`

      if (LOGGING_ENABLED) {
        logInfo("Fixed verification_uri_complete:", json.verification_uri_complete)
      }
    }

    return json as DeviceAuthorizationResponse
  } catch (error) {
    logError("device code request error:", error)
    return null
  }
}

export async function pollForToken(
  deviceCode: string,
  verifier: string,
  interval = 2,
): Promise<TokenResult> {
  void interval

  try {
    const res = await fetch(QWEN_OAUTH.TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: QWEN_OAUTH.GRANT_TYPE_DEVICE,
        client_id: QWEN_OAUTH.CLIENT_ID,
        device_code: deviceCode,
        code_verifier: verifier,
      }),
    })

    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      const error = json.error

      if (error === "authorization_pending") return { type: "pending" }
      if (error === "slow_down") return { type: "slow_down" }
      if (error === "expired_token") return { type: "expired" }
      if (error === "access_denied") return { type: "denied" }

      logError("token poll failed:", { status: res.status, json })
      return { type: "failed" }
    }

    const json = (await res.json()) as Partial<QwenTokenResponse>

    if (LOGGING_ENABLED) {
      logInfo("Token response received:", {
        has_access_token: !!json.access_token,
        has_refresh_token: !!json.refresh_token,
        expires_in: json.expires_in,
        resource_url: json.resource_url,
        all_fields: Object.keys(json),
      })
    }

    if (!validateTokenResponse(json, "token response")) {
      return { type: "failed" }
    }

    json.resource_url = normalizeResourceUrl(json.resource_url)
    if (!json.resource_url) {
      logWarn("No valid resource_url in token response, will use default Portal endpoint")
    }

    return {
      type: "success",
      access: json.access_token,
      refresh: json.refresh_token,
      expires: Date.now() + json.expires_in * 1000,
      resourceUrl: json.resource_url,
    }
  } catch (error) {
    logError("token poll error:", error)
    return { type: "failed" }
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResult> {
  try {
    const res = await fetch(QWEN_OAUTH.TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: QWEN_OAUTH.GRANT_TYPE_REFRESH,
        client_id: QWEN_OAUTH.CLIENT_ID,
        refresh_token: refreshToken,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      logError("token refresh failed:", { status: res.status, text })
      return { type: "failed" }
    }

    const json = (await res.json()) as Partial<QwenTokenResponse>

    if (LOGGING_ENABLED) {
      logInfo("Token refresh response received:", {
        has_access_token: !!json.access_token,
        has_refresh_token: !!json.refresh_token,
        expires_in: json.expires_in,
        resource_url: json.resource_url,
        all_fields: Object.keys(json),
      })
    }

    if (!validateTokenResponse(json, "refresh response")) {
      return { type: "failed" }
    }

    json.resource_url = normalizeResourceUrl(json.resource_url)
    if (!json.resource_url) {
      logWarn("No valid resource_url in refresh response, will use default Portal endpoint")
    }

    return {
      type: "success",
      access: json.access_token,
      refresh: json.refresh_token,
      expires: Date.now() + json.expires_in * 1000,
      resourceUrl: json.resource_url,
    }
  } catch (error) {
    logError("token refresh error:", error)
    return { type: "failed" }
  }
}

export async function createPKCE(): Promise<PKCEPair> {
  const { challenge, verifier } = await generatePKCE()
  return { challenge, verifier }
}

function getOAuthAuth(auth: Auth): OAuth | null {
  if (auth.type !== "oauth") {
    return null
  }

  return auth
}

async function saveOAuthToken(client: AuthClient, tokenResult: TokenResult): Promise<void> {
  if (tokenResult.type !== "success") {
    throw new Error("Cannot save non-success token result")
  }

  try {
    await client.auth.set({
      path: { id: PROVIDER_ID },
      body: {
        type: "oauth",
        access: tokenResult.access,
        refresh: tokenResult.refresh,
        expires: tokenResult.expires,
        enterpriseUrl: tokenResult.resourceUrl,
      },
    })
  } catch (error) {
    logError("Failed to save auth:", error)
    throw error
  }
}

export function isTokenExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt - TOKEN_REFRESH_BUFFER_MS
}

export async function getValidToken(
  client: AuthClient,
  auth: Auth,
): Promise<{
  accessToken: string
  resourceUrl?: string
} | null> {
  const stored = getOAuthAuth(auth)
  if (!stored) return null

  if (!isTokenExpired(stored.expires)) {
    return {
      accessToken: stored.access,
      resourceUrl: stored.enterpriseUrl,
    }
  }

  if (LOGGING_ENABLED) {
    logInfo("Token expired, refreshing...")
  }

  const refreshResult = await refreshAccessToken(stored.refresh)
  if (refreshResult.type !== "success") {
    logError("Token refresh failed, re-authentication required")
    return null
  }

  await saveOAuthToken(client, refreshResult)

  return {
    accessToken: refreshResult.access,
    resourceUrl: refreshResult.resourceUrl,
  }
}

export function getApiBaseUrl(resourceUrl?: string): string {
  if (!resourceUrl) {
    if (LOGGING_ENABLED) {
      logInfo("No resource_url provided, using default Portal API URL")
    }
    return DEFAULT_QWEN_BASE_URL
  }

  try {
    const url = new URL(resourceUrl)
    if (!url.protocol.startsWith("http")) {
      logWarn("Invalid resource_url protocol, using default Portal API URL")
      return DEFAULT_QWEN_BASE_URL
    }

    let baseUrl = resourceUrl.replace(/\/$/, "")
    if (!baseUrl.endsWith("/v1")) {
      baseUrl = `${baseUrl}/v1`
    }

    if (LOGGING_ENABLED) {
      logInfo("Constructed Portal API base URL from resource_url:", baseUrl)
    }

    return baseUrl
  } catch (error) {
    logWarn("Invalid resource_url format, using default Portal API URL:", error)
    return DEFAULT_QWEN_BASE_URL
  }
}
