# opencode-copilot-usage-toast

A plugin for [OpenCode](https://opencode.ai) that displays your GitHub Copilot premium requests quota after each conversation.

Inspired by [sst/opencode#768](https://github.com/sst/opencode/issues/768).

## How it looks

![Copilot Usage Toast](./assets/screenshot.png)

**Note:** GitHub's billing API has a delay. Usage may take minutes to update.

## Quick Start

### 1. Create a GitHub Token (PAT)

1. Go to [**GitHub Fine-grained Token Settings**](https://github.com/settings/personal-access-tokens/new)
2. Generate a token with:
   - **Resource owner:** Your username
   - **Repository access:** `Public Repositories (read-only)` or `No access`
   - **Account permissions:** **Plan** -> `Read-only`

### 2. Configure Environment Variables

#### macOS / Linux (Bash, Zsh, Fish)
Add to your shell config (`~/.bashrc`, `~/.zshrc`, or `~/.config/fish/config.fish`):

```bash
export GITHUB_USERNAME="your-github-username"
export GITHUB_PAT="github_pat_xxxx"
export COPILOT_QUOTA=300  # 50 (free) | 300 (pro) | 1500 (pro+)
```

> **Note:** For Fish, use `export` instead of `set -gx`.

#### Windows (PowerShell)
Add to your PowerShell profile (`code $PROFILE`):

```powershell
$env:GITHUB_USERNAME = "your-github-username"
$env:GITHUB_PAT = "github_pat_xxxx"
$env:COPILOT_QUOTA = "300"
```

### 3. Install Plugin

Add the package to your `opencode.json` configuration file:

**macOS / Linux:** `~/.config/opencode/opencode.json`
**Windows:** `%USERPROFILE%\.config\opencode\opencode.json`

```json
{
  "plugin": [
    "opencode-copilot-usage-toast"
  ]
}
```

Restart OpenCode to load the plugin.

---

## Manual Installation (Legacy)

If you prefer not to use the NPM package, you can manually install the plugin file:

```bash
mkdir -p ~/.config/opencode/plugin
curl -o ~/.config/opencode/plugin/copilot-usage.ts \
  https://raw.githubusercontent.com/fgonzalezurriola/opencode-copilot-usage/main/src/index.ts
```

## Troubleshooting

### "Failed to fetch quota"
- Verify your PAT has the **Plan (read-only)** permission.
- Check that `GITHUB_USERNAME` matches your GitHub handle exactly.

### Test API Manually

**Bash/Zsh:**
```bash
curl -s \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_PAT" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/users/$GITHUB_USERNAME/settings/billing/premium_request/usage?year=$(date +%Y)&month=$(date +%-m)"
```

**PowerShell:**
```powershell
$headers = @{
  "Accept" = "application/vnd.github+json"
  "Authorization" = "Bearer $env:GITHUB_PAT"
  "X-GitHub-Api-Version" = "2022-11-28"
}
$year = (Get-Date).Year
$month = (Get-Date).Month
Invoke-RestMethod -Uri "https://api.github.com/users/$env:GITHUB_USERNAME/settings/billing/premium_request/usage?year=$year&month=$month" -Headers $headers
```

## License

MIT
