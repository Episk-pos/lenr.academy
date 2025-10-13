# PR Screenshot Methodology

This document describes the methodology for generating and including screenshots in Pull Requests to document UI changes.

## Overview

Visual documentation of UI changes helps reviewers understand the impact of changes and provides a historical record of the application's evolution. Screenshots are automatically generated using Playwright-based scenarios.

## Tools

### AI-Powered Screenshot Tools

**New in v0.1.0-alpha.9**: Three AI-assisted tools to create screenshot scenarios.

#### Option 1: Slash Command (AI Analyzes Your PR)

```bash
# In Claude Code, type:
/screenshots

# Claude analyzes your git diff and suggests scenarios automatically
# Example output:
# "I found changes to ShowElementData.tsx. I suggest:
#  1. pr-32-atomic-radii-card (scroll y=1800)
#  2. pr-32-3-column-layout (scroll y=1800)"
```

**What it does:**
- Analyzes `git diff main` to find changed files
- Identifies visual changes (new components, layouts, etc.)
- Applies learned heuristics for scroll positions
- Generates ready-to-use scenario JSON
- Offers to add scenarios to config file

**Best for:** Quick scenario generation when you trust AI estimates

#### Option 2: AI-Assisted Interactive Helper

```bash
npm run screenshots:helper:ai pr-32-new-feature
```

**What it does:**
- Opens browser with interaction tracking
- Logs everything you do (navigate, scroll, click)
- Shows scroll position overlay in real-time
- Press `E` to export log for Claude Code
- Paste log into Claude → get perfect scenario JSON

**Keyboard Shortcuts:**
- `S` - Take screenshot preview
- `L` - Show interaction log
- `E` - Export for Claude Code (copy/paste)
- `C` - Clear log
- `T` - Toggle theme
- `V` - Change viewport
- `Q` - Quit

**Workflow:**
1. Run `npm run screenshots:helper:ai pr-32-feature`
2. Navigate and interact with your app
3. Press `E` when done
4. Copy the output text
5. Paste into Claude Code: "Generate scenario from these interactions"
6. Claude creates perfect JSON matching your actions
7. Add to `screenshot-scenarios.json`

**Best for:** Complex scenarios requiring specific interactions

#### Option 3: Manual Helper (No AI)

```bash
npm run screenshots:helper pr-32-new-feature
```

**What it does:**
- Opens browser with scroll position overlay
- Press `S` for preview screenshots
- Press `R` to record scroll position
- Press `E` to export scenario JSON manually
- You refine the JSON yourself

**Best for:** When you want full control, no AI assistance

### Generate PR Screenshots

```bash
# Generate a specific scenario
npm run screenshots:pr <scenario-name>

# Generate all scenarios
npm run screenshots:pr all

# List available scenarios
npm run screenshots:pr
```

### Configuration

Screenshots are configured in `screenshot-scenarios.json` at the project root. Each scenario defines:

- **name**: Human-readable name
- **description**: What the screenshot shows
- **page**: URL path to navigate to
- **viewport**: Screen size (e.g., `desktop-16:9-small`, `mobile-16:9`)
- **theme**: `light` or `dark`
- **actions**: Array of automated actions to perform
- **output**: Filename for the screenshot

## Scenario Actions

Available action types:

| Action | Description | Parameters |
|--------|-------------|------------|
| `wait-for-db` | Wait for database to load | `timeout` (optional) |
| `accept-metered` | Accept metered connection warning if present | - |
| `wait` | Wait for specified duration | `timeout` (ms) |
| `click` | Click an element | `selector` |
| `scroll` | Scroll the page | `x`, `y` (pixels) |
| `input` | Fill a form field | `selector`, `value` |
| `select-element` | Click an element in periodic table | `element` (symbol) |
| `run-query` | Click "Run Query" button and wait for results | - |
| `toggle-theme` | Toggle dark/light mode | - |
| `navigate` | Navigate to a URL | `url` |

## Example Scenario

```json
{
  "pr-30-decay-table": {
    "name": "PR #30 - Radioactive Decay Table",
    "description": "Shows improved decay table UX with responsive layout for Uranium-235",
    "page": "/element-data?Z=92&A=235",
    "viewport": "desktop-16:9-small",
    "theme": "light",
    "actions": [
      { "type": "wait-for-db" },
      { "type": "accept-metered" },
      { "type": "wait", "timeout": 2000 },
      { "type": "scroll", "y": 400 }
    ],
    "output": "pr-30-decay-table-u235.png"
  }
}
```

## Viewport Sizes

Standard viewports for 16:9 aspect ratio:

- `desktop-16:9`: 1920×1080 (high resolution)
- `desktop-16:9-small`: 1280×720 (standard)
- `tablet-16:9`: 1024×576
- `mobile-16:9`: 640×360

All screenshots use 16:9 aspect ratio for consistent presentation in PR descriptions.

## Workflow for New PRs

### 1. Before Creating PR

When making UI changes:

1. **Create scenario(s)** in `screenshot-scenarios.json` that showcase your changes
2. **Generate screenshots**: `npm run screenshots:pr <scenario-name>`
3. **Review screenshots** in `docs/screenshots/pr/`
4. **Commit scenario config** (but not screenshots - see below)

### 2. Creating the PR

1. **Push your changes** (code + scenario config)
2. **Generate screenshots locally**
3. **Upload screenshots to PR**:
   - Option A: GitHub's image upload in PR description editor
   - Option B: Store in GitHub releases and link
   - Option C: Commit to `docs/screenshots/pr/` if under 100KB each

4. **Add Screenshots section** to PR description:

```markdown
## Screenshots

### Feature Name

![Description](https://user-images.githubusercontent.com/.../screenshot.png)

*Caption explaining what the screenshot shows*
```

### 3. Updating the PR

If you need to update screenshots:

1. Modify scenario in `screenshot-scenarios.json`
2. Regenerate: `npm run screenshots:pr <scenario-name>`
3. Replace images in PR description

## Best Practices

### Naming Convention

Screenshot filenames follow the pattern: `pr-{number}-{feature-slug}.png`

Examples:
- `pr-30-radioactive-indicators-periodic-table.png`
- `pr-31-mobile-table-layout.png`
- `pr-11-atomic-radii-card.png`

### What to Capture

**DO capture:**
- New UI components or layouts
- Visual changes to existing components
- Responsive behavior (mobile vs desktop)
- Theme variations (dark mode changes)
- Before/after comparisons for refactoring

**DON'T capture:**
- Backend-only changes (API, database)
- Minor text or copy changes
- Bug fixes with no visual impact
- Refactoring with identical output

### Screenshot Guidelines

1. **Focus on the feature**: Scroll and position to highlight what changed
2. **Use realistic data**: Show actual query results or element details
3. **Maintain consistency**: Use standard viewports and themes
4. **Add context**: Include surrounding UI elements for orientation
5. **Avoid sensitive data**: No real user data or API keys

## Storage Considerations

### Small PRs (< 5 screenshots, < 500KB total)

Commit directly to `docs/screenshots/pr/`:

```bash
git add docs/screenshots/pr/pr-30-*.png
git commit -m "docs: add screenshots for PR #30"
```

### Large PRs (> 5 screenshots or > 500KB)

Use GitHub's image upload feature:
1. Edit PR description
2. Drag and drop images
3. GitHub hosts on `user-images.githubusercontent.com`

### Historical PRs

For retroactive documentation of merged PRs, upload screenshots and edit PR descriptions using:

```bash
gh pr edit <number> --body "$(cat new-description.md)"
```

Or use the GitHub web interface to edit PR descriptions.

## Troubleshooting

### Dev server not running

Screenshots require a running dev server:

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run screenshots:pr <scenario>
```

### Timeouts waiting for elements

If element selection times out, the periodic table may not be rendering on that page. Consider:
- Using URL parameters instead (`/element-data?Z=26`)
- Simplifying the scenario
- Increasing timeout values

### Screenshots look wrong

- Clear browser cache: delete `docs/screenshots/pr/` and regenerate
- Check viewport size matches the page layout
- Verify actions execute in correct order
- Add wait actions between steps

## Examples

See existing scenarios in `screenshot-scenarios.json` for working examples of:
- Element data page navigation (PR #30, #11)
- Mobile responsive layouts (PR #31)
- Query page interactions (PR #29)
- Dark mode variations (PR #30)

## Related Documentation

- [CONTRIBUTING.md](../CONTRIBUTING.md) - General contribution guidelines
- [DEVELOPMENT.md](DEVELOPMENT.md) - Development setup and architecture
- `screenshot-scenarios.json` - Scenario configuration file
- `scripts/generate-pr-screenshots.ts` - Screenshot generation script
