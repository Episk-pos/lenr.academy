#!/bin/bash
set -e

# Upload database to S3 with versioning
# Usage: ./scripts/upload-db.sh [version]
# Example: ./scripts/upload-db.sh v1.0.0
# If no version is provided, uses version from package.json

VERSION=${1}
DB_FILE="public/parkhomov.db"
META_FILE="public/parkhomov.db.meta.json"
S3_BUCKET="s3://db.lenr.academy"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

# If no version provided, try to get from existing metadata file
if [ -z "$VERSION" ]; then
  if [ -f "$META_FILE" ]; then
    echo -e "${BLUE}No version specified, reading from $META_FILE...${NC}"

    if command -v jq &> /dev/null; then
      # Use jq if available
      META_VERSION=$(jq -r '.version' "$META_FILE")
    elif command -v node &> /dev/null; then
      # Fallback to node
      META_VERSION=$(node -p "require('./$META_FILE').version")
    else
      echo -e "${RED}Error: Cannot read metadata file (jq or node required)${NC}"
      echo "Please provide version as argument: $0 <version>"
      exit 1
    fi

    if [ -n "$META_VERSION" ] && [ "$META_VERSION" != "null" ]; then
      VERSION="$META_VERSION"
      echo -e "${GREEN}Using version from metadata: $VERSION${NC}"
      echo ""
    fi
  fi

  # If still no version, error out
  if [ -z "$VERSION" ]; then
    echo -e "${RED}Error: Version required${NC}"
    echo ""
    echo "Usage: $0 <version>"
    echo "Example: $0 v1.0.0"
    echo ""
    echo "Or create $META_FILE with a version field first"
    exit 1
  fi
fi

if [ ! -f "$DB_FILE" ]; then
  echo -e "${RED}Error: Database file not found: $DB_FILE${NC}"
  exit 1
fi

echo -e "${YELLOW}📦 Uploading database version: $VERSION${NC}"
echo ""

# Calculate checksum
echo "🔢 Calculating MD5 checksum..."
if command -v md5sum &> /dev/null; then
  CHECKSUM=$(md5sum "$DB_FILE" | awk '{print $1}')
elif command -v md5 &> /dev/null; then
  CHECKSUM=$(md5 -q "$DB_FILE")
else
  echo -e "${RED}Error: No MD5 utility found (tried md5sum and md5)${NC}"
  exit 1
fi
echo "   Checksum: $CHECKSUM"

# Get file size
FILE_SIZE=$(stat -f%z "$DB_FILE" 2>/dev/null || stat -c%s "$DB_FILE" 2>/dev/null)
echo "   Size: $(numfmt --to=iec-i --suffix=B $FILE_SIZE 2>/dev/null || echo $FILE_SIZE bytes)"

# Create or update metadata file
echo ""
echo "📝 Creating metadata file..."
cat > "$META_FILE" <<EOF
{
  "version": "$VERSION",
  "checksum": "$CHECKSUM",
  "size": $FILE_SIZE,
  "s3_path": "$S3_BUCKET/$VERSION/parkhomov.db",
  "updated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

# Upload versioned files
echo ""
echo "☁️  Uploading to $S3_BUCKET/$VERSION/..."
aws s3 cp "$DB_FILE" "$S3_BUCKET/$VERSION/parkhomov.db"
aws s3 cp "$META_FILE" "$S3_BUCKET/$VERSION/parkhomov.db.meta.json"

# Update latest
echo ""
echo "🔄 Updating latest version..."
aws s3 cp "$DB_FILE" "$S3_BUCKET/latest/parkhomov.db"
aws s3 cp "$META_FILE" "$S3_BUCKET/latest/parkhomov.db.meta.json"

# Generate and upload index
echo ""
echo "📄 Generating and uploading index..."
bash "$(dirname "$0")/generate-db-index.sh"

echo ""
echo -e "${GREEN}✅ Database upload complete!${NC}"
echo ""
echo "Version: $VERSION"
echo "S3 URL: https://db.lenr.academy/$VERSION/parkhomov.db"
echo "Latest: https://db.lenr.academy/latest/parkhomov.db"
