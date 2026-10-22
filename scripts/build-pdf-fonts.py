#!/usr/bin/env python3
"""
Build the subset Noto Sans fonts used by PDF export (src/utils/pdfFonts.ts).

jsPDF's built-in fonts only cover Latin-1, so PDF exports that contain
Cyrillic, Greek, CJK, Hangul, Devanagari, Arabic or symbols such as "→"
need an embedded Unicode TrueType font. The fonts are served as static
assets from public/fonts/pdf/ and fetched lazily at export time, so they never
enter the JS bundle.

Each output font is a static (non-variable) Regular instance, subsetted and
merged with a common "base" (Latin, Greek, Cyrillic, punctuation, arrows,
math operators) because jsPDF cannot fall back between fonts per glyph.
OpenType layout tables (GSUB/GPOS/GDEF) are dropped: jsPDF does not apply
them, so they would only add weight. Hinting is dropped as well.

CJK/Hangul coverage = a broad common-character set derived from the legacy
national encodings (JIS X 0208 level 1, GB2312 level 1, KS X 1001 Hangul)
plus every character that appears in the matching UI locale file, so all
translated strings are guaranteed to render.

Usage (normally via scripts/fetch-pdf-fonts.sh, which downloads the sources):
    python3 scripts/build-pdf-fonts.py <source-dir> <output-dir>

Requires: fonttools (pip install fonttools)
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

REPO_ROOT = Path(__file__).resolve().parent.parent
LOCALES_DIR = REPO_ROOT / "src" / "i18n" / "locales"

# Tables jsPDF never reads (or that break fontTools.merge across families).
DROP_TABLES = [
    "GSUB", "GPOS", "GDEF", "BASE", "JSTF", "MATH", "STAT", "DSIG",
    "vhea", "vmtx", "VORG", "meta", "kern", "morx", "feat",
]


def rng(a: int, b: int) -> set[int]:
    return set(range(a, b + 1))


# Shared by every output font.
BASE_CODEPOINTS = (
    rng(0x0020, 0x007E)      # Basic Latin
    | rng(0x00A0, 0x024F)    # Latin-1 Supplement, Latin Extended-A/B
    | rng(0x0300, 0x036F)    # Combining Diacritical Marks
    | rng(0x0370, 0x03FF)    # Greek
    | rng(0x0400, 0x052F)    # Cyrillic + Supplement
    | rng(0x1D00, 0x1DBF)    # Phonetic Extensions (e.g. ᴺ)
    | rng(0x1E00, 0x1EFF)    # Latin Extended Additional
    | rng(0x2000, 0x206F)    # General Punctuation
    | rng(0x2070, 0x209F)    # Superscripts and Subscripts
    | rng(0x20A0, 0x20CF)    # Currency
    | rng(0x2100, 0x214F)    # Letterlike (e.g. ℏ, №)
    | rng(0x2190, 0x21FF)    # Arrows (→ ↔ ⇌)
    | rng(0x2200, 0x22FF)    # Mathematical Operators (≤ ≥ ± −)
    | {0xFFFD}
)

# A few symbols taken from Noto Sans Symbols 2 (Noto Sans has none of them).
# Whole blocks would add ~90 KiB to every font, so only the common ones plus
# any symbol from these blocks that a locale file uses (see main()).
SYMBOL_BLOCKS = (
    rng(0x2300, 0x23FF)      # Miscellaneous Technical (e.g. ⌘ in the SQL run-shortcut hint)
    | rng(0x25A0, 0x25FF) | rng(0x2600, 0x26FF) | rng(0x2700, 0x27BF)
)
SYMBOL_CODEPOINTS = {
    0x25A0, 0x25A1, 0x25B2, 0x25B3, 0x25BC, 0x25BD, 0x25C6, 0x25C7, 0x25CB, 0x25CF,  # ■□▲△▼▽◆◇○●
    0x2605, 0x2606, 0x26A0, 0x26A1,                                                  # ★☆⚠⚡
    0x2713, 0x2714, 0x2717, 0x2718,                                                  # ✓✔✗✘
}


def encoding_chars(encoding: str, rows: range, cells: range = range(0xA1, 0xFF)) -> set[int]:
    """Characters of a double-byte legacy charset, by EUC row range."""
    out: set[int] = set()
    for row in rows:
        for cell in cells:
            try:
                ch = bytes([row, cell]).decode(encoding)
            except UnicodeDecodeError:
                continue
            if len(ch) == 1:
                out.add(ord(ch))
    return out


def locale_chars(locale: str) -> set[int]:
    data = json.loads((LOCALES_DIR / f"{locale}.json").read_text(encoding="utf-8"))
    out: set[int] = set()

    def walk(v):
        if isinstance(v, str):
            out.update(ord(c) for c in v)
        elif isinstance(v, dict):
            for x in v.values():
                walk(x)
        elif isinstance(v, list):
            for x in v:
                walk(x)

    walk(data)
    return {c for c in out if c >= 0x20}


def all_locale_chars() -> set[int]:
    out: set[int] = set()
    for path in LOCALES_DIR.glob("*.json"):
        out |= locale_chars(path.stem)
    return out


CJK_COMMON = (
    rng(0x3000, 0x303F)      # CJK Symbols and Punctuation
    | rng(0xFF00, 0xFFEF)    # Halfwidth and Fullwidth Forms
)

# (output file, source file, codepoints beyond BASE)
TARGETS: list[tuple[str, str | None, set[int]]] = [
    ("NotoSans-Regular.ttf", None, set()),
    (
        "NotoSansJP-Regular.ttf",
        "NotoSansJP[wght].ttf",
        CJK_COMMON
        | rng(0x3040, 0x30FF)                                   # Hiragana, Katakana
        | rng(0x31F0, 0x31FF)                                   # Katakana ext
        | encoding_chars("euc_jp", range(0xB0, 0xD0))          # JIS X 0208 level-1 kanji
        | locale_chars("ja"),
    ),
    (
        "NotoSansSC-Regular.ttf",
        "NotoSansSC[wght].ttf",
        CJK_COMMON
        | encoding_chars("gb2312", range(0xB0, 0xD8))          # GB2312 level-1 hanzi
        | locale_chars("zh"),
    ),
    (
        "NotoSansKR-Regular.ttf",
        "NotoSansKR[wght].ttf",
        CJK_COMMON
        | rng(0x3130, 0x318F)                                   # Hangul Compatibility Jamo
        | encoding_chars("euc_kr", range(0xB0, 0xC9))          # KS X 1001 Hangul syllables
        | locale_chars("ko"),
    ),
    (
        "NotoSansDevanagari-Regular.ttf",
        "NotoSansDevanagari[wdth,wght].ttf",
        rng(0x0900, 0x097F) | rng(0xA8E0, 0xA8FF) | rng(0x1CD0, 0x1CFF)
        | {0x200C, 0x200D, 0x25CC}
        | locale_chars("hi"),
    ),
    (
        "NotoSansArabic-Regular.ttf",
        "NotoSansArabic[wdth,wght].ttf",
        rng(0x0600, 0x06FF) | rng(0x0750, 0x077F)
        # Presentation forms: jsPDF's processArabic() shapes text by mapping
        # letters to these code points, so they MUST stay in the cmap.
        | rng(0xFB50, 0xFDFF) | rng(0xFE70, 0xFEFF)
        | {0x200C, 0x200D, 0x200E, 0x200F}
        | locale_chars("ar"),
    ),
]


def static_instance(path: Path) -> TTFont:
    font = TTFont(path)
    if "fvar" in font:
        axes = {a.axisTag: (400 if a.axisTag == "wght" else 100 if a.axisTag == "wdth" else a.defaultValue)
                for a in font["fvar"].axes}
        font = instancer.instantiateVariableFont(font, axes)
    return font


def subset_font(font: TTFont, codepoints: set[int]) -> TTFont:
    opts = subset.Options()
    opts.layout_features = []
    opts.drop_tables += DROP_TABLES
    opts.hinting = False
    opts.notdef_outline = True
    opts.glyph_names = False
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    opts.recalc_bounds = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=sorted(codepoints))
    s.subset(font)
    for tag in DROP_TABLES:
        if tag in font:
            del font[tag]
    return font


def merge(paths: list[Path], out: Path) -> None:
    merged = Merger().merge([str(p) for p in paths])
    for tag in DROP_TABLES:
        if tag in merged:
            del merged[tag]
    merged.save(out)


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    src = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp_s:
        tmp = Path(tmp_s)

        # Base = Noto Sans (Latin/Greek/Cyrillic) + Noto Sans Math (arrows,
        # operators: Noto Sans itself has no U+2190 block) + Noto Sans
        # Symbols 2 (⚠ ✓ ●).
        latin = subset_font(static_instance(src / "NotoSans[wdth,wght].ttf"), BASE_CODEPOINTS)
        latin.save(tmp / "latin.ttf")
        math = subset_font(TTFont(src / "NotoSansMath-Regular.ttf"), rng(0x2190, 0x22FF))
        math.save(tmp / "math.ttf")
        symbols = subset_font(
            TTFont(src / "NotoSansSymbols2-Regular.ttf"),
            SYMBOL_CODEPOINTS | (all_locale_chars() & SYMBOL_BLOCKS),
        )
        symbols.save(tmp / "symbols.ttf")
        base = tmp / "base.ttf"
        merge([tmp / "latin.ttf", tmp / "math.ttf", tmp / "symbols.ttf"], base)

        for out_name, src_name, extra in TARGETS:
            target = out_dir / out_name
            if src_name is None:
                TTFont(base).save(target)
            else:
                script = subset_font(static_instance(src / src_name), extra)
                script_path = tmp / out_name
                script.save(script_path)
                # Base first: Latin/Greek/Cyrillic glyphs come from Noto Sans for
                # a consistent look; the script font fills in the rest.
                merge([base, script_path], target)
            cmap = TTFont(target).getBestCmap()
            print(f"{out_name}: {target.stat().st_size / 1024:.0f} KiB, {len(cmap)} code points")

    write_license(src, out_dir)
    return 0


def write_license(src: Path, out_dir: Path) -> None:
    """OFL.txt with the copyright notice of every source font we derive from."""
    sources = ["NotoSans[wdth,wght].ttf", "NotoSansMath-Regular.ttf", "NotoSansSymbols2-Regular.ttf"] + [s for _, s, _ in TARGETS if s]
    notices = []
    for name in sources:
        notice = TTFont(src / name, lazy=True)["name"].getDebugName(0)
        if notice and notice not in notices:
            notices.append(notice)
    ofl = (src / "OFL.txt").read_text(encoding="utf-8")
    body = ofl[ofl.index("This Font Software is licensed"):]
    header = (
        "Subset/merged derivatives of the Noto Sans font families, built by\n"
        "scripts/build-pdf-fonts.py. Original copyright notices:\n\n"
        + "\n".join(notices)
        + "\n\n"
    )
    (out_dir / "OFL.txt").write_text(header + body, encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
