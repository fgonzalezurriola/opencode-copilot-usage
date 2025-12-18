/**
 * OpenCode Plugin: Copilot Usage
 *
 * Displays GitHub Copilot premium requests quota after each conversation.
 * Only activates when using github-copilot provider.
 * Requires GITHUB_USERNAME, COPILOT_QUOTA and GITHUB_PAT environment variables.
 *
 * @see https://github.com/sst/opencode/issues/768
 */

interface UsageItem {
  product: string;
  sku: string;
  model?: string;
  unitType: string;
  pricePerUnit: number;
  grossQuantity: number;
  grossAmount: number;
  discountQuantity: number;
  discountAmount: number;
  netQuantity: number;
  netAmount: number;
}

interface UsageResponse {
  timePeriod: { year: number; month?: number };
  user: string;
  usageItems: UsageItem[];
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

const DEFAULT_QUOTA = 300
const GITHUB_COPILOT_PREFIX = "github-copilot"

function getQuota(): number {
  const envQuota = process.env.COPILOT_QUOTA
  if (envQuota) {
    const parsed = parseInt(envQuota, 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return DEFAULT_QUOTA
}

function createProgressBar(used: number, total: number, width = 20): string {
  const percentage = Math.min(100, Math.round((used / total) * 100));
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;

  const filledChar = "█";
  const emptyChar = "░";

  return `${filledChar.repeat(filled)}${emptyChar.repeat(empty)}`;
}

async function fetchCopilotUsage(
  username: string,
  token: string,
): Promise<{ used: number; quota: number } | null> {
  try {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;

    const url = `https://api.github.com/users/${username}/settings/billing/premium_request/usage?year=${year}&month=${month}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      console.error(`[copilot-usage] API error: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as UsageResponse;

    // Sum all Copilot premium requests using grossQuantity
    // (netQuantity is 0 for plans with 100% discount like Student Pack)
    const used = data.usageItems
      .filter(
        (item) =>
          item.product === "Copilot" && item.sku.includes("Premium Request"),
      )
      .reduce((sum, item) => sum + item.grossQuantity, 0);

    return { used, quota: getQuota() }
  } catch (error) {
    console.error("[copilot-usage] Failed to fetch usage:", error);
    return null;
  }
}

type ToastVariant = "info" | "success" | "warning" | "error";

const CopilotUsagePlugin = async ({ client }: { client: any }) => {
  const username = process.env.GITHUB_USERNAME
  const token = process.env.GITHUB_PAT
  let lastProviderID: string | null = null
  let credentialsWarningShown = false

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

      if (!username || !token) {
        if (!credentialsWarningShown) {
          await client.tui.showToast({
            body: {
              title: "Copilot Usage",
              message: "Missing GITHUB_USERNAME or GITHUB_PAT",
              variant: "warning" as ToastVariant,
              duration: 5000,
            },
          })
          credentialsWarningShown = true
        }
        return
      }

      const usage = await fetchCopilotUsage(username, token);

      if (!usage) {
        await client.tui.showToast({
          body: {
            title: "Copilot Usage",
            message: "Failed to fetch quota",
            variant: "warning" as ToastVariant,
            duration: 5000,
          },
        });
        return;
      }

      const { used, quota } = usage;
      const percentage = (used / quota) * 100;
      const remaining = Math.max(0, quota - used);
      const bar = createProgressBar(used, quota);

      let variant: ToastVariant = "info";
      if (percentage >= 90) variant = "error";
      else if (percentage >= 75) variant = "warning";

      const usedDisplay = Number.isInteger(used) ? used : used.toFixed(1);
      const remainingDisplay = Number.isInteger(remaining) ? remaining : remaining.toFixed(1);
      const percentDisplay = Number.isInteger(percentage) ? percentage : percentage.toFixed(1);

      const message = `${bar} ${percentDisplay}%\n${usedDisplay}/${quota} • ${remainingDisplay} left`;

      await client.tui.showToast({
        body: {
          title: "Copilot Premium Requests",
          message,
          variant,
          duration: 8000,
        },
      });
    },
  };
};

export default CopilotUsagePlugin;
