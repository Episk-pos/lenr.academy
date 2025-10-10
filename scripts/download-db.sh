#!/bin/bash
set -e

# Download database from S3
# Usage:
#   ./scripts/download-db.sh           # Downloads latest version
#   ./scripts/download-db.sh v1.2.3    # Downloads specific version

VERSION=${1:-latest}
S3_BUCKET="s3://db.lenr.academy"
PUBLIC_DIR="public"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📥 Downloading database version: $VERSION${NC}"
echo ""

# Ensure public directory exists
mkdir -p "$PUBLIC_DIR"

# Check if AWS CLI is available
if command -v aws &> /dev/null; then
  echo -e "${BLUE}Using AWS CLI for download...${NC}"

  # Download database
  echo "  Downloading parkhomov.db..."
  aws s3 cp "$S3_BUCKET/$VERSION/parkhomov.db" "$PUBLIC_DIR/parkhomov.db" --no-sign-request

  # Download metadata
  echo "  Downloading parkhomov.db.meta.json..."
  aws s3 cp "$S3_BUCKET/$VERSION/parkhomov.db.meta.json" "$PUBLIC_DIR/parkhomov.db.meta.json" --no-sign-request
else
  echo -e "${BLUE}AWS CLI not found, using HTTPS download...${NC}"
  echo -e "${YELLOW}(Install AWS CLI for faster downloads)${NC}"

  # Fallback to HTTPS
  HTTPS_BASE="https://db.lenr.academy.s3.amazonaws.com"

  echo "  Downloading parkhomov.db..."
  curl -f -L -o "$PUBLIC_DIR/parkhomov.db" "$HTTPS_BASE/$VERSION/parkhomov.db"

  echo "  Downloading parkhomov.db.meta.json..."
  curl -f -L -o "$PUBLIC_DIR/parkhomov.db.meta.json" "$HTTPS_BASE/$VERSION/parkhomov.db.meta.json"
fi

echo ""
echo -e "${GREEN}✅ Database download complete!${NC}"
echo ""

# Show metadata
if [ -f "$PUBLIC_DIR/parkhomov.db.meta.json" ]; then
  echo "Database info:"
  if command -v jq &> /dev/null; then
    jq '.' "$PUBLIC_DIR/parkhomov.db.meta.json"
  else
    cat "$PUBLIC_DIR/parkhomov.db.meta.json"
  fi
  echo ""
fi

echo -e "${BLUE}Location: $PUBLIC_DIR/parkhomov.db${NC}"
echo -e "${BLUE}Ready for development: npm run dev${NC}"
echo ""
