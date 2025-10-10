#!/bin/bash
set -e

# Generate index.html and versions.json for S3 database bucket
# This script lists all versions from S3 and creates human-readable and machine-readable indexes

S3_BUCKET="s3://db.lenr.academy"
TEMP_DIR=$(mktemp -d)
INDEX_HTML="$TEMP_DIR/index.html"
VERSIONS_JSON="$TEMP_DIR/versions.json"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔍 Scanning S3 bucket for versions...${NC}"

# List all version directories (exclude latest/)
VERSIONS=$(aws s3 ls "$S3_BUCKET/" | grep "PRE" | awk '{print $2}' | sed 's/\///' | grep -v "^latest$" | sort -V)

if [ -z "$VERSIONS" ]; then
  echo "No versions found in S3 bucket"
  exit 1
fi

echo "Found versions:"
echo "$VERSIONS" | sed 's/^/  - /'
echo ""

# Build versions.json
echo -e "${YELLOW}📝 Generating versions.json...${NC}"
echo "{" > "$VERSIONS_JSON"
echo '  "bucket": "db.lenr.academy",' >> "$VERSIONS_JSON"
echo '  "updated": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",' >> "$VERSIONS_JSON"
echo '  "versions": [' >> "$VERSIONS_JSON"

FIRST=true
for VERSION in $VERSIONS; do
  # Get metadata if it exists
  META_PATH="$S3_BUCKET/$VERSION/parkhomov.db.meta.json"
  META_LOCAL="$TEMP_DIR/meta_$VERSION.json"

  if aws s3 cp "$META_PATH" "$META_LOCAL" 2>/dev/null; then
    # Parse metadata
    CHECKSUM=$(cat "$META_LOCAL" | grep -o '"checksum": "[^"]*"' | cut -d'"' -f4)
    SIZE=$(cat "$META_LOCAL" | grep -o '"size": [0-9]*' | cut -d' ' -f2)
    UPDATED=$(cat "$META_LOCAL" | grep -o '"updated": "[^"]*"' | cut -d'"' -f4)
  else
    # Fallback if no metadata
    CHECKSUM="unknown"
    SIZE=0
    UPDATED=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  fi

  if [ "$FIRST" = false ]; then
    echo "," >> "$VERSIONS_JSON"
  fi
  FIRST=false

  cat >> "$VERSIONS_JSON" <<EOF
    {
      "version": "$VERSION",
      "url": "https://db.lenr.academy/$VERSION/parkhomov.db",
      "checksum": "$CHECKSUM",
      "size": $SIZE,
      "updated": "$UPDATED"
    }
EOF
done

echo "" >> "$VERSIONS_JSON"
echo "  ]" >> "$VERSIONS_JSON"
echo "}" >> "$VERSIONS_JSON"

# Generate index.html
echo -e "${YELLOW}📄 Generating index.html...${NC}"
cat > "$INDEX_HTML" <<'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LENR Academy Database Versions</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 2rem;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      text-align: center;
    }
    header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    header p {
      opacity: 0.9;
      font-size: 1.1rem;
    }
    main {
      padding: 2rem;
    }
    .latest {
      background: #f0f9ff;
      border: 2px solid #3b82f6;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .latest h2 {
      color: #1e40af;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .latest .badge {
      background: #3b82f6;
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .version-list h2 {
      margin-bottom: 1.5rem;
      color: #1f2937;
    }
    .version {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1rem;
      transition: all 0.2s;
    }
    .version:hover {
      border-color: #667eea;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
      transform: translateY(-2px);
    }
    .version-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .version-name {
      font-size: 1.25rem;
      font-weight: 600;
      color: #667eea;
    }
    .version-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.75rem;
      font-size: 0.875rem;
      color: #6b7280;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .meta-item strong {
      color: #374151;
    }
    .download-btn {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 0.5rem 1.5rem;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      transition: background 0.2s;
      margin-top: 0.75rem;
    }
    .download-btn:hover {
      background: #5568d3;
    }
    footer {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
    footer a {
      color: #667eea;
      text-decoration: none;
    }
    footer a:hover {
      text-decoration: underline;
    }
    code {
      background: #f3f4f6;
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      font-size: 0.875em;
      font-family: 'Monaco', 'Courier New', monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🔬 LENR Academy Database</h1>
      <p>Parkhomov Nuclear Reaction Tables</p>
    </header>

    <main>
      <div class="latest">
        <h2>
          Latest Version
          <span class="badge">Current</span>
        </h2>
        <p style="margin-bottom: 1rem;">
          For development and production use. Always points to the most recent stable version.
        </p>
        <a href="https://db.lenr.academy/latest/parkhomov.db" class="download-btn">
          ⬇️ Download Latest
        </a>
        <p style="margin-top: 1rem; font-size: 0.875rem; color: #6b7280;">
          <strong>CLI:</strong> <code>aws s3 cp s3://db.lenr.academy/latest/parkhomov.db .</code>
        </p>
      </div>

      <div class="version-list">
        <h2>📦 All Versions</h2>
        <div id="versions">
          <!-- Versions will be inserted here by JavaScript -->
        </div>
      </div>
    </main>

    <footer>
      <p>
        Database maintained by <a href="https://lenr.academy" target="_blank">LENR Academy</a>
        <br>
        <a href="https://github.com/Episk-pos/lenr.academy" target="_blank">View on GitHub</a>
      </p>
    </footer>
  </div>

  <script>
    // Fetch and display versions
    fetch('versions.json')
      .then(response => response.json())
      .then(data => {
        const container = document.getElementById('versions');
        const versions = data.versions.reverse(); // Show newest first

        versions.forEach(version => {
          const sizeInMB = (version.size / (1024 * 1024)).toFixed(1);
          const date = new Date(version.updated).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

          const versionDiv = document.createElement('div');
          versionDiv.className = 'version';
          versionDiv.innerHTML = `
            <div class="version-header">
              <div class="version-name">${version.version}</div>
            </div>
            <div class="version-meta">
              <div class="meta-item">
                <strong>Size:</strong> ${sizeInMB} MB
              </div>
              <div class="meta-item">
                <strong>Updated:</strong> ${date}
              </div>
              <div class="meta-item">
                <strong>MD5:</strong> <code>${version.checksum.substring(0, 8)}...</code>
              </div>
            </div>
            <a href="${version.url}" class="download-btn">⬇️ Download ${version.version}</a>
          `;
          container.appendChild(versionDiv);
        });
      })
      .catch(error => {
        console.error('Error loading versions:', error);
        document.getElementById('versions').innerHTML =
          '<p style="color: #ef4444;">Failed to load version list. Please try again later.</p>';
      });
  </script>
</body>
</html>
EOF

# Upload to S3
echo ""
echo -e "${YELLOW}☁️  Uploading to S3...${NC}"
aws s3 cp "$INDEX_HTML" "$S3_BUCKET/index.html" --content-type "text/html"
aws s3 cp "$VERSIONS_JSON" "$S3_BUCKET/versions.json" --content-type "application/json"

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo -e "${GREEN}✅ Index generation complete!${NC}"
echo ""
echo "View at: https://db.lenr.academy/index.html"
echo "API: https://db.lenr.academy/versions.json"
