/**
 * OpenCode Plugin: Copilot Usage
 *
 * Displays GitHub Copilot premium requests quota after each conversation.
 * Only activates when using github-copilot provider.
 * Zero configuration - reads auth from OpenCode's stored credentials.
 *
 * @see https://github.com/sst/opencode/issues/768
 */

import { readFile } from "fs/promises"
import { homedir } from "os"
import { join } from "path"

interface QuotaSnapshot {
  entitlement: number
  remaining: number
  percent_remaining: number
  unlimited: boolean
}

interface CopilotUserResponse {
  quota_snapshots: {
    premium_interactions: QuotaSnapshot
  }
  quota_reset_date: string
}

interface OpenCodeAuth {
  "github-copilot"?: {
    access: string
    refresh: string
    expires: number
  }
}

interface AssistantMessage {
  role: "assistant"
  providerID: string
  modelID: string
}

interface MessageUpdatedEvent {
  type: "message.updated"
  properties: {
    info: AssistantMessage | { role: "user" }
  }
}

interface SessionIdleEvent {
  type: "session.idle"
  properties: {
    sessionID: string
  }
}

type PluginEvent = MessageUpdatedEvent | SessionIdleEvent | { type: string }

const GITHUB_COPILOT_PREFIX = "github-copilot"

async function getRefreshToken(): Promise<string | null> {
  try {
    const authPath = join(homedir(), ".local", "share", "opencode", "auth.json")
    const content = await readFile(authPath, "utf-8")
    const auth = JSON.parse(content) as OpenCodeAuth
    return auth["github-copilot"]?.refresh ?? null
  } catch {
    return null
  }
}

function createProgressBar(used: number, total: number, width = 20): string {
  const percentage = Math.min(100, Math.round((used / total) * 100))
  const filled = Math.round((percentage / 100) * width)
  const empty = width - filled

  const filledChar = "█"
  const emptyChar = "░"

  return `${filledChar.repeat(filled)}${emptyChar.repeat(empty)}`
}

async function fetchCopilotUsage(
  token: string
): Promise<{ used: number; quota: number; remaining: number } | null> {
  try {
    const response = await fetch(
      "https://api.github.com/copilot_internal/user",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    )

    if (!response.ok) {
      console.error(`[copilot-usage] API error: ${response.status}`)
      return null
    }

    const data = (await response.json()) as CopilotUserResponse
    const premium = data.quota_snapshots?.premium_interactions

    if (!premium || premium.unlimited) {
      return null
    }

    const quota = premium.entitlement
    const remaining = premium.remaining
    const used = quota - remaining

    return { used, quota, remaining }
  } catch (error) {
    console.error("[copilot-usage] Failed to fetch usage:", error)
    return null
  }
}

type ToastVariant = "info" | "success" | "warning" | "error"

const CopilotUsagePlugin = async ({ client }: { client: any }) => {
  let lastProviderID: string | null = null
  let authWarningShown = false
  const token = await getRefreshToken()

  return {
    event: async ({ event }: { event: PluginEvent }) => {
      if (event.type === "message.updated") {
        const msg = (event as MessageUpdatedEvent).properties.info
        if (msg.role === "assistant") {
          lastProviderID = msg.providerID
        }
        return
      }

      if (event.type !== "session.idle") return

      if (!lastProviderID?.startsWith(GITHUB_COPILOT_PREFIX)) {
        return
      }

      if (!token) {
        if (!authWarningShown) {
          await client.tui.showToast({
            body: {
              title: "Copilot Usage",
              message: "Not authenticated with GitHub Copilot",
              variant: "warning" as ToastVariant,
              duration: 5000,
            },
          })
          authWarningShown = true
        }
        return
      }

      const usage = await fetchCopilotUsage(token)

      if (!usage) {
        await client.tui.showToast({
          body: {
            title: "Copilot Usage",
            message: "Failed to fetch quota",
            variant: "warning" as ToastVariant,
            duration: 5000,
          },
        })
        return
      }

      const { used, quota, remaining } = usage
      const percentage = (used / quota) * 100
      const bar = createProgressBar(used, quota)

      let variant: ToastVariant = "info"
      if (percentage >= 90) variant = "error"
      else if (percentage >= 75) variant = "warning"

      const usedDisplay = Number.isInteger(used) ? used : used.toFixed(1)
      const remainingDisplay = Number.isInteger(remaining)
        ? remaining
        : remaining.toFixed(1)
      const percentDisplay = Number.isInteger(percentage)
        ? percentage
        : percentage.toFixed(1)

      const message = `${bar} ${percentDisplay}%\n${usedDisplay}/${quota} • ${remainingDisplay} left`

      await client.tui.showToast({
        body: {
          title: "Copilot Premium Requests",
          message,
          variant,
          duration: 8000,
        },
      })
    },
  }
}

export default CopilotUsagePlugin
