# Release Process

This document describes how to create and publish releases for LENR Academy.

## Prerequisites

- Clean working directory (no uncommitted changes)
- On `main` branch (or confirm to proceed from another branch)
- GPG signing key configured: `git config user.signingkey YOUR_KEY_ID`
- GitHub CLI authenticated: `gh auth status`
- `jq` installed: `sudo pacman -S jq`

## Quick Start

### Standard Releases

```bash
# Bug fix release (0.0.1 → 0.0.2)
npm run release:patch

# New feature release (0.0.1 → 0.1.0)
npm run release:minor

# Breaking change release (0.0.1 → 1.0.0)
npm run release:major
```

### Pre-Releases

```bash
# Alpha pre-release (0.0.1 → 0.0.2-alpha.0)
npm run release:prerelease

# Beta pre-release (0.0.1 → 0.0.2-beta.0)
npm run release:beta
```

## What Happens During a Release

1. **Validation**
   - Checks working directory is clean
   - Verifies you're on `main` branch (or prompts to continue)
   - Confirms GPG signing key is configured

2. **Version Bump**
   - Calculates new version based on bump type
   - Updates `package.json` with new version
   - Shows old and new versions for confirmation

3. **Git Commit & Tag**
   - Commits version bump: `"chore: bump version to vX.Y.Z"`
   - Creates GPG-signed annotated tag: `vX.Y.Z`
   - Shows recent commits that will be included

4. **Confirmation**
   - Displays release summary
   - Prompts to push to remote and create GitHub Release
   - Option to cancel and keep changes local

5. **Publish**
   - Pushes commit to remote `main`
   - Pushes signed tag to remote
   - Creates GitHub Release with auto-generated notes
   - Marks pre-releases appropriately on GitHub

6. **Success**
   - Displays release URL
   - Shows verification that tag is signed

## Version Bumping Rules

### Semantic Versioning (semver)

- **Patch** (`x.y.Z`): Bug fixes, no new features, no breaking changes
- **Minor** (`x.Y.0`): New features, backwards compatible
- **Major** (`X.0.0`): Breaking changes, not backwards compatible

### Pre-Releases

Pre-releases follow the format: `x.y.z-identifier.N`

- First pre-release: `0.0.2-alpha.0`
- Subsequent pre-releases: `0.0.2-alpha.1`, `0.0.2-alpha.2`, etc.

**Types:**
- `alpha` - Early testing, unstable
- `beta` - Feature complete, testing for bugs
- `rc` (release candidate) - Final testing before release

## Examples

### Standard Release Workflow

```bash
# Current version: 0.0.1

npm run release:patch
# Creates v0.0.2
# ✓ Bug fixes and patches

npm run release:minor
# Creates v0.1.0
# ✓ New features added

npm run release:major
# Creates v1.0.0
# ✓ Breaking changes introduced
```

### Pre-Release Workflow

```bash
# Current version: 0.0.1

# Start alpha testing
npm run release:prerelease
# Creates v0.0.2-alpha.0

# More alpha releases
npm run release:prerelease
# Creates v0.0.2-alpha.1

# Move to beta
npm run release:beta
# Creates v0.0.2-beta.0

# Final release (removes pre-release suffix)
npm run release:patch
# Creates v0.0.2
```

## Cancelling a Release

If you proceed through version bump and tagging but decide not to push:

```bash
# Delete the local tag
git tag -d v0.0.2

# Reset the version bump commit
git reset HEAD~1

# Restore package.json
git checkout package.json
```

## Troubleshooting

### "Working directory is not clean"
**Solution:** Commit or stash your changes first
```bash
git status
git add .
git commit -m "your message"
```

### "GPG signing key not configured"
**Solution:** Set your GPG key
```bash
git config user.signingkey YOUR_KEY_ID
```

### "gh: command not found"
**Solution:** Install GitHub CLI
```bash
sudo pacman -S github-cli
gh auth login
```

### "jq: command not found"
**Solution:** Install jq
```bash
sudo pacman -S jq
```

### Release created but want to delete
**Solution:** Delete both the GitHub release and git tag
```bash
# Delete GitHub release
gh release delete v0.0.2 --yes

# Delete remote tag
git push gh --delete v0.0.2

# Delete local tag
git tag -d v0.0.2
```

## GitHub Release Features

### Auto-Generated Release Notes

The release script uses `gh release create --generate-notes` which automatically:
- Lists all commits since the last release
- Groups by contributor
- Includes links to commits and PRs
- Shows comparison view

### Pre-Release Badges

Pre-releases are marked with:
- "Pre-release" badge on GitHub
- Not shown as "Latest" release
- Useful for testing before official release

### Release Assets

#### Parkhomov Database (Automatic)

For **non-prerelease** versions, the `parkhomov.db` file (161MB) is automatically uploaded to the GitHub Release during deployment via the `deploy.yml` workflow. This happens after the build step and before AWS deployment.

#### Manual Database Upload

If you need to upload the database manually to any release:
```bash
npm run release:upload-db
```

This will upload `public/parkhomov.db` to the latest git tag.

#### Other Assets

To add other release assets (e.g., built bundles):
```bash
# After creating release
gh release upload v0.0.2 ./dist/bundle.zip
```

## Best Practices

1. **Always release from `main`** - Ensures consistency
2. **Use semantic versioning** - Helps users understand changes
3. **Test before releasing** - Run tests with `npm run test:e2e`
4. **Use pre-releases for testing** - Get feedback before official release
5. **Write good commit messages** - They appear in release notes
6. **Keep working directory clean** - Avoid accidental inclusions

## Script Location

The release script is located at: `scripts/release.sh`

To run it directly:
```bash
bash scripts/release.sh <patch|minor|major|prerelease> [alpha|beta|rc]
```
