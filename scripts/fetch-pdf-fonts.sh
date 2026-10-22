#!/usr/bin/env bash
# Download Noto Sans sources (SIL OFL 1.1) from google/fonts and build the
# subset TTFs served from public/fonts/pdf/ for PDF export.
#
# Re-run after adding characters to ja/zh/ko/hi locale files that fall
# outside the common-character sets (src/utils/pdfFonts.test.ts will tell you).
#
# Requires: curl, python3 with fonttools (pip install fonttools)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$REPO_ROOT/public/fonts/pdf"
SRC_DIR="${PDF_FONT_SRC_DIR:-${TMPDIR:-/tmp}/lenr-pdf-font-src}"
BASE_URL="https://raw.githubusercontent.com/google/fonts/main/ofl"

FILES=(
  "notosans/NotoSans[wdth,wght].ttf"
  "notosans/OFL.txt"
  "notosansmath/NotoSansMath-Regular.ttf"
  "notosanssymbols2/NotoSansSymbols2-Regular.ttf"
  "notosansjp/NotoSansJP[wght].ttf"
  "notosanssc/NotoSansSC[wght].ttf"
  "notosanskr/NotoSansKR[wght].ttf"
  "notosansdevanagari/NotoSansDevanagari[wdth,wght].ttf"
  "notosansarabic/NotoSansArabic[wdth,wght].ttf"
)

python3 -c "import fontTools" 2>/dev/null || {
  echo "fonttools is required: pip install fonttools" >&2
  exit 1
}

mkdir -p "$SRC_DIR" "$OUT_DIR"
for f in "${FILES[@]}"; do
  name="$(basename "$f")"
  if [[ -s "$SRC_DIR/$name" ]]; then
    echo "cached  $name"
    continue
  fi
  url="$BASE_URL/${f//[/%5B}"
  url="${url//]/%5D}"
  echo "fetch   $name"
  curl -sSfL --retry 3 -o "$SRC_DIR/$name" "$url"
done

python3 "$REPO_ROOT/scripts/build-pdf-fonts.py" "$SRC_DIR" "$OUT_DIR"
echo "Fonts written to $OUT_DIR"
