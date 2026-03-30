import type { Plugin, Hooks, PluginInput } from "@opencode-ai/plugin"
import type { Auth, Provider } from "@opencode-ai/sdk"

import { createPKCE, requestDeviceCode, pollForToken, getValidToken, getApiBaseUrl } from "./lib/auth/auth.js"
import { openBrowserUrl } from "./lib/auth/browser.js"
import { loadPluginConfig, getQwenMode } from "./lib/config.js"
import { AUTH_LABELS, DEVICE_FLOW, PROVIDER_ID } from "./lib/constants.js"
import { logRequest, LOGGING_ENABLED } from "./lib/logger.js"
import { getOpenCodeQwenPrompt } from "./lib/prompts/opencode-qwen.js"
import { buildHeaders, rewriteUrl } from "./lib/request/fetch-helpers.js"
import { mergeHeaders } from "./lib/request/header-utils.js"
import { normalizeSseToOpenAI } from "./lib/request/response-handler.js"
import { transformRequestBody } from "./lib/request/request-transformer.js"

export const QwenAuthPlugin: Plugin = async ({ client }: PluginInput): Promise<Hooks> => {
  return {
    auth: {
      provider: PROVIDER_ID,
      async loader(getAuth: () => Promise<Auth>, _provider: Provider) {
        const auth = await getAuth()

        if (auth.type !== "oauth") {
          return {}
        }

        const tokenData = await getValidToken(client, auth)
        if (!tokenData) {
          throw new Error("Authentication required. Please run: opencode auth login")
        }

        const baseUrl = getApiBaseUrl(tokenData.resourceUrl)
        const pluginConfig = loadPluginConfig()
        const qwenMode = getQwenMode(pluginConfig)

        return {
          apiKey: tokenData.accessToken,
          baseURL: baseUrl,
          async fetch(input: RequestInfo | URL, init?: RequestInit) {
            const currentAuth = await getAuth()
            const currentToken = await getValidToken(client, currentAuth)

            if (!currentToken) {
              return new Response(
                JSON.stringify({
                  error: "authentication_required",
                  message: "Authentication required. Please run: opencode auth login",
                  code: "AUTH_REQUIRED",
                }),
                {
                  status: 401,
                  headers: { "Content-Type": "application/json" },
                },
              )
            }

            const dynamicBaseUrl = getApiBaseUrl(currentToken.resourceUrl)
            const originalUrl =
              typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url
            const url = rewriteUrl(originalUrl, dynamicBaseUrl)

            let transformedInit: RequestInit = { ...init }
            if (init?.body && typeof init.body === "string") {
              const body = JSON.parse(init.body) as Record<string, unknown>
              const openCodeQwenPrompt = qwenMode ? await getOpenCodeQwenPrompt() : ""
              const transformed = transformRequestBody(body, qwenMode, openCodeQwenPrompt)
              transformedInit.body = JSON.stringify(transformed)
            }

            const built = buildHeaders(currentToken.accessToken)
            const finalHeaders = mergeHeaders(transformedInit.headers, built, [
              "authorization",
              "content-type",
              "x-dashscope-authtype",
            ])
            transformedInit.headers = finalHeaders

            if (LOGGING_ENABLED) {
              const maskedAuth = finalHeaders.Authorization ? "Bearer ***" : undefined
              const { Authorization, ...rest } = finalHeaders
              logRequest("before-fetch", {
                url,
                headers: { ...rest, Authorization: maskedAuth },
                qwenMode,
              })
            }

            const response = await fetch(url, transformedInit)

            if (response.status === 429) {
              const retryAfter = response.headers.get("Retry-After")
              const message = retryAfter
                ? `Rate limited. Please try again in ${retryAfter} seconds.`
                : "Rate limited. Please try again later."

              console.error(`[qwenchat-auth-plugin] ${message}`)

              return new Response(
                JSON.stringify({
                  error: "rate_limit_exceeded",
                  message,
                  code: "RATE_LIMIT",
                }),
                {
                  status: 429,
                  headers: {
                    "Content-Type": "application/json",
                    ...(retryAfter ? { "Retry-After": retryAfter } : {}),
                  },
                },
              )
            }

            const contentType = response.headers.get("content-type")?.toLowerCase() || ""
            if (contentType.includes("text/event-stream")) {
              try {
                return await normalizeSseToOpenAI(response)
              } catch {
                return response
              }
            }

            return response
          },
        }
      },
      methods: [
        {
          label: AUTH_LABELS.OAUTH,
          type: "oauth",
          authorize: async () => {
            const pkce = await createPKCE()
            const deviceAuth = await requestDeviceCode(pkce)

            if (!deviceAuth) {
              throw new Error("Failed to request device code")
            }

            console.log(`\nPlease visit: ${deviceAuth.verification_uri}`)
            console.log(`And enter code: ${deviceAuth.user_code}\n`)

            const verificationUrl =
              deviceAuth.verification_uri_complete || deviceAuth.verification_uri
            openBrowserUrl(verificationUrl)

            return {
              url: verificationUrl,
              method: "auto",
              instructions: AUTH_LABELS.INSTRUCTIONS,
              callback: async () => {
                let pollInterval = (deviceAuth.interval || 2) * 1000
                const maxInterval = DEVICE_FLOW.MAX_POLL_INTERVAL
                const startTime = Date.now()
                const expiresIn = deviceAuth.expires_in * 1000

                while (Date.now() - startTime < expiresIn) {
                  await new Promise((resolve) => setTimeout(resolve, pollInterval))
                  const result = await pollForToken(deviceAuth.device_code, pkce.verifier)

                  if (result.type === "success") {
                    return {
                      type: "success",
                      access: result.access,
                      refresh: result.refresh,
                      expires: result.expires,
                      enterpriseUrl: result.resourceUrl,
                    }
                  }

                  if (result.type === "slow_down") {
                    pollInterval = Math.min(
                      pollInterval * DEVICE_FLOW.BACKOFF_MULTIPLIER,
                      maxInterval,
                    )
                    continue
                  }

                  if (result.type === "pending") {
                    continue
                  }

                  if (result.type === "denied") {
                    console.error("[qwenchat-auth-plugin] User denied authorization")
                    return { type: "failed" as const }
                  }

                  if (result.type === "expired") {
                    console.error("[qwenchat-auth-plugin] Device code expired")
                    return { type: "failed" as const }
                  }

                  if (result.type === "failed") {
                    console.error("[qwenchat-auth-plugin] Token request failed")
                    return { type: "failed" as const }
                  }
                }

                console.error("[qwenchat-auth-plugin] Device authorization timed out")
                return { type: "failed" as const }
              },
            }
          },
        },
      ],
    },
  }
}

export default QwenAuthPlugin
