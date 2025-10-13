# Screenshot Quickstart Guide

Quick reference for creating PR screenshot scenarios with AI assistance.

## 🚀 Quick Start (Recommended Workflow)

### Step 1: Let AI Suggest Scenarios

In Claude Code, type:
```
/screenshots
```

Claude analyzes your git diff and suggests scenarios with scroll positions.

### Step 2: Refine with Interactive Helper (Optional)

If AI estimates need adjustment:
```bash
npm run screenshots:helper:ai pr-XX-feature-name
```

1. Browser opens showing your app
2. Navigate and scroll to the perfect position
3. Press `E` to export
4. Paste into Claude Code
5. Ask: "Generate scenario from these interactions"

### Step 3: Generate Screenshots

```bash
npm run screenshots:pr pr-XX-feature-name
```

### Step 4: Upload to S3

```bash
aws s3 cp docs/screenshots/pr/pr-XX-feature-name.png s3://db.lenr.academy/screenshots/pr/
```

### Step 5: Update PR Description

```bash
gh pr edit XX --body "$(cat pr-description.md)"
```

## 📊 When to Use Which Tool

| Situation | Tool | Command |
|-----------|------|---------|
| Just finished a PR with UI changes | AI Slash Command | `/screenshots` in Claude Code |
| AI scroll position is close but not perfect | AI Interactive Helper | `npm run screenshots:helper:ai pr-XX` |
| Complex interaction sequence (clicks, etc.) | AI Interactive Helper | `npm run screenshots:helper:ai pr-XX` |
| Want full manual control | Manual Helper | `npm run screenshots:helper pr-XX` |

## 🎯 Common Scenarios

### New Component on Element Data Page

**Example:** Added AtomicRadiiCard to ShowElementData page

```bash
# Option 1: Let AI suggest
/screenshots

# Option 2: Use AI helper
npm run screenshots:helper:ai pr-32-atomic-radii-card

# Navigate to /element-data?Z=26, scroll to ~1800px
# Press E, paste into Claude Code
```

### Mobile Responsive Table

**Example:** Fixed table overflow on mobile

```bash
/screenshots

# Claude suggests:
# - viewport: mobile-16:9
# - scroll: y=1200-1600
# - page: /fusion or /fission
```

### Decay Table Feature

**Example:** Added collapsible decay table

```bash
# Two scenarios needed: collapsed + expanded

/screenshots

# Claude suggests both scenarios:
# 1. pr-XX-decay-table-collapsed (scroll y=1550)
# 2. pr-XX-decay-table-expanded (scroll y=1550, then click expand)
```

## 💡 Pro Tips

1. **Always start with `/screenshots`** - Let AI do the heavy lifting
2. **Use AI helper for precision** - When scroll position matters
3. **Dev server must be running** - `npm run dev` in another terminal
4. **Version filenames for cache-busting** - Use `-v2`, `-v3` suffixes on S3
5. **Test scenarios before committing** - Run `npm run screenshots:pr` to verify

## 🔧 Troubleshooting

### "Dev server not running"
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run screenshots:pr pr-XX-feature
```

### "Wrong scroll position"
```bash
# Use AI helper to find exact position
npm run screenshots:helper:ai pr-XX-feature

# Navigate, find position, export for Claude
```

### "CloudFront shows old image"
```bash
# Use versioned filename on S3
cp image.png image-v2.png
aws s3 cp image-v2.png s3://db.lenr.academy/screenshots/pr/

# Update PR with new URL ending in -v2.png
```

## 📚 Learn More

- [PR_SCREENSHOTS.md](./PR_SCREENSHOTS.md) - Complete documentation
- [screenshot-scenarios.json](../screenshot-scenarios.json) - Example scenarios
- `.claude/commands/screenshots.md` - Slash command source
- `.claude/memory/screenshot-workflow.md` - AI heuristics

## 🎓 Example Workflow (Real PR)

```bash
# 1. Finish your PR work
git add .
git commit -m "feat: add atomic radii card"

# 2. Ask Claude for scenarios
# In Claude Code:
/screenshots

# Claude responds:
# "I found changes to ShowElementData.tsx. I suggest:
#  pr-32-atomic-radii-iron (Z=26, scroll y=1800)
#  pr-32-atomic-radii-tungsten (Z=74, scroll y=1800)"
#
# Would you like me to add these to screenshot-scenarios.json?

# You: Yes, add them

# 3. Generate screenshots
npm run screenshots:pr pr-32-atomic-radii-iron pr-32-atomic-radii-tungsten

# 4. Review screenshots
open docs/screenshots/pr/pr-32-atomic-radii-iron.png

# 5. Upload to S3
aws s3 cp docs/screenshots/pr/pr-32-atomic-radii-iron.png \
  s3://db.lenr.academy/screenshots/pr/
aws s3 cp docs/screenshots/pr/pr-32-atomic-radii-tungsten.png \
  s3://db.lenr.academy/screenshots/pr/

# 6. Create PR with screenshots
gh pr create \
  --title "feat: add atomic radii card" \
  --body "See screenshots in PR description"

# 7. Edit PR to add screenshot section
gh pr edit 32 --body "$(cat pr-description-with-screenshots.md)"
```

Done! ✨
