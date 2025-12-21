# opencode-copilot-usage-toast

A plugin for [OpenCode](https://opencode.ai) that displays your GitHub Copilot premium requests quota after each conversation.

Inspired by [sst/opencode#768](https://github.com/sst/opencode/issues/768).

## How it looks

![Copilot Usage Toast](./assets/looks.png)

## Installation

Add to your `opencode.json`:

```json
{
  "plugins": ["opencode-copilot-usage-toast"]
}
```

That's it. The plugin reads your Copilot authentication from OpenCode automatically.

## How it works

1. Listens for the `session.idle` event (when a conversation ends)
2. Checks if the last message came from `github-copilot`
3. Reads your auth token from `~/.local/share/opencode/auth.json`
4. Fetches quota from GitHub's internal Copilot API
5. Displays a toast with usage info

## Requirements

- OpenCode authenticated with GitHub Copilot (run `opencode` and sign in)

## Troubleshooting

**"Not authenticated with GitHub Copilot"**
- Make sure you've signed in to GitHub Copilot in OpenCode

**"Failed to fetch quota"**
- Your auth token may have expired - re-authenticate in OpenCode

## License

MIT
