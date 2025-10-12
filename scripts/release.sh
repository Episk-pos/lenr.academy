#!/usr/bin/env bash

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed. Install with: sudo pacman -S jq${NC}"
    exit 1
fi

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed. Install with: sudo pacman -S github-cli${NC}"
    exit 1
fi

# Check if GPG signing key is configured
if ! git config --get user.signingkey &> /dev/null; then
    echo -e "${RED}Error: GPG signing key not configured. Set with: git config user.signingkey YOUR_KEY_ID${NC}"
    exit 1
fi

# Parse arguments
BUMP_TYPE="${1:-}"
PRERELEASE_IDENTIFIER="${2:-alpha}"

if [ -z "$BUMP_TYPE" ]; then
    echo -e "${RED}Usage: $0 <patch|minor|major|prerelease> [alpha|beta|rc]${NC}"
    echo ""
    echo "Examples:"
    echo "  $0 patch                    # 0.0.1 → 0.0.2"
    echo "  $0 minor                    # 0.0.1 → 0.1.0"
    echo "  $0 major                    # 0.0.1 → 1.0.0"
    echo "  $0 prerelease              # 0.0.1 → 0.0.2-alpha.0"
    echo "  $0 prerelease beta         # 0.0.1 → 0.0.2-beta.0"
    exit 1
fi

# Validate bump type
if [[ ! "$BUMP_TYPE" =~ ^(patch|minor|major|prerelease)$ ]]; then
    echo -e "${RED}Error: Invalid bump type '$BUMP_TYPE'. Use: patch, minor, major, or prerelease${NC}"
    exit 1
fi

cd "$PROJECT_ROOT"

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}Error: Working directory is not clean. Commit or stash changes first.${NC}"
    echo ""
    git status --short
    exit 1
fi

# Check if on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}Warning: Not on 'main' branch (currently on '$CURRENT_BRANCH')${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Get current version from latest git tag (source of truth)
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

if [ -z "$LATEST_TAG" ]; then
    echo -e "${YELLOW}No existing tags found. Starting from 0.0.0${NC}"
    CURRENT_VERSION="0.0.0"
else
    # Strip the 'v' prefix if present (e.g., v0.1.0-alpha.0 → 0.1.0-alpha.0)
    CURRENT_VERSION="${LATEST_TAG#v}"
    echo -e "${BLUE}Latest tag: $LATEST_TAG${NC}"
fi

echo -e "${BLUE}Current version: $CURRENT_VERSION${NC}"

# Calculate new version
bump_version() {
    local version=$1
    local bump_type=$2
    local prerelease_id=$3

    # Split version into major.minor.patch(-prerelease)
    # Handle formats: 0.1.0 or 0.1.0-alpha.0
    if [[ "$version" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)(-(.+))?$ ]]; then
        local major="${BASH_REMATCH[1]}"
        local minor="${BASH_REMATCH[2]}"
        local patch="${BASH_REMATCH[3]}"
        local prerelease_suffix="${BASH_REMATCH[5]}"
    else
        echo "Error: Invalid version format: $version" >&2
        return 1
    fi

    case $bump_type in
        patch)
            patch=$((patch + 1))
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        prerelease)
            # If already a prerelease with the same identifier, increment the prerelease number
            if [[ -n "$prerelease_suffix" ]]; then
                # Extract prerelease identifier and number (e.g., "alpha.0" → "alpha" and "0")
                if [[ "$prerelease_suffix" =~ ^([a-z]+)\.([0-9]+)$ ]]; then
                    local current_pre_id="${BASH_REMATCH[1]}"
                    local pre_num="${BASH_REMATCH[2]}"

                    # If same prerelease identifier, increment the number
                    if [ "$current_pre_id" = "$prerelease_id" ]; then
                        pre_num=$((pre_num + 1))
                        echo "${major}.${minor}.${patch}-${prerelease_id}.${pre_num}"
                        return
                    fi
                fi
            fi

            # Otherwise, bump patch and add prerelease suffix
            patch=$((patch + 1))
            echo "${major}.${minor}.${patch}-${prerelease_id}.0"
            return
            ;;
    esac

    echo "${major}.${minor}.${patch}"
}

NEW_VERSION=$(bump_version "$CURRENT_VERSION" "$BUMP_TYPE" "$PRERELEASE_IDENTIFIER")
echo -e "${GREEN}New version: $NEW_VERSION${NC}"
echo ""

# Confirm before proceeding
read -p "Proceed with release v$NEW_VERSION? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Release cancelled."
    exit 0
fi

# Update version in package.json
echo -e "${BLUE}Updating package.json...${NC}"
jq ".version = \"$NEW_VERSION\"" package.json > package.json.tmp && mv package.json.tmp package.json

# Commit version bump
echo -e "${BLUE}Committing version bump...${NC}"
git add package.json
git commit -m "chore: bump version to v$NEW_VERSION"

# Create GPG-signed annotated tag
echo -e "${BLUE}Creating GPG-signed tag v$NEW_VERSION...${NC}"
git tag -s "v$NEW_VERSION" -m "Release v$NEW_VERSION"

# Show what will be released
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Release Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Tag:       ${GREEN}v$NEW_VERSION${NC}"
echo -e "Branch:    ${BLUE}$CURRENT_BRANCH${NC}"
echo -e "Signed:    ${GREEN}✓ GPG${NC}"
echo ""
echo "Recent commits to be included:"
git log --oneline -5
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Confirm push
read -p "Push tag v$NEW_VERSION to remote and create GitHub Release? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Tag created locally but not pushed. You can push manually with:${NC}"
    echo "  git push gh main"
    echo "  git push gh v$NEW_VERSION"
    echo ""
    echo -e "${YELLOW}Or delete the tag with:${NC}"
    echo "  git tag -d v$NEW_VERSION"
    echo "  git reset HEAD~1"
    exit 0
fi

# Push to remote
echo -e "${BLUE}Pushing to remote...${NC}"
git push gh main
git push gh "v$NEW_VERSION"

# Always create as pre-release for staging deployment
# After QA approval, manually promote to full release for production deployment
echo -e "${BLUE}Creating GitHub Pre-Release (for staging deployment)...${NC}"
gh release create "v$NEW_VERSION" \
    --title "v$NEW_VERSION" \
    --generate-notes \
    --prerelease

# Get release URL
RELEASE_URL=$(gh release view "v$NEW_VERSION" --json url -q .url)

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Pre-release v$NEW_VERSION published successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "View release: ${BLUE}$RELEASE_URL${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. GitHub Actions will automatically deploy to staging.lenr.academy"
echo "2. After QA approval, uncheck 'pre-release' on GitHub to deploy to production"
echo ""
