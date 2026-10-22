import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { jsPDF } from 'jspdf'
import {
  PDF_FONTS,
  applyPdfFont,
  arrayBufferToBase64,
  clearPdfFontCache,
  detectScripts,
  loadPdfFont,
  normalizePdfText,
  selectPdfFont,
  toLatin1Fallback,
  type PdfFontSpec,
  type PdfFontTarget,
} from './pdfFonts'

const FONT_DIR = resolve(__dirname, '../../public/fonts/pdf') + '/'
const LOCALE_DIR = resolve(__dirname, '../i18n/locales') + '/'

function okResponse(bytes: Uint8Array): Response {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as unknown as Response
}

function fakeDoc(): PdfFontTarget & { fonts: Record<string, string[]> } {
  const fonts: Record<string, string[]> = { helvetica: ['normal', 'bold'] }
  return {
    fonts,
    addFileToVFS: vi.fn(),
    addFont: vi.fn((_file: string, family: string, style: string) => {
      fonts[family] = [...(fonts[family] ?? []), style]
    }),
    setFont: vi.fn(),
    getFontList: () => fonts,
  }
}

function localeStrings(locale: string): string[] {
  const out: string[] = []
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(JSON.parse(readFileSync(`${LOCALE_DIR}${locale}.json`, 'utf-8')))
  return out.map(normalizePdfText)
}

describe('detectScripts', () => {
  it('reports latin1 only for plain Latin-1 text', () => {
    expect([...detectScripts(['Hello', 'Größe ×²', null, undefined, ''])]).toEqual(['latin1'])
  })

  it('flags symbols and Latin Extended outside Latin-1 as extended', () => {
    expect(detectScripts(['A → B']).has('extended')).toBe(true)
    expect(detectScripts(['Łódź']).has('extended')).toBe(true)
    expect(detectScripts(['e⁻']).has('extended')).toBe(true)
  })

  it.each([
    ['ν β α', 'greek'],
    ['Привет', 'cyrillic'],
    ['Ґанок', 'cyrillic'],
    ['ひらがな カタカナ', 'kana'],
    ['核融合', 'han'],
    ['핵융합', 'hangul'],
    ['नाभिकीय', 'devanagari'],
    ['اندماج', 'arabic'],
  ])('detects %s as %s', (text, script) => {
    expect(detectScripts([text]).has(script as never)).toBe(true)
  })
})

describe('selectPdfFont', () => {
  const pick = (text: string, lang = 'en') => selectPdfFont(detectScripts([text]), lang)?.id ?? null

  it('keeps Helvetica for Latin-1 content regardless of UI language', () => {
    expect(pick('Fusion Reactions', 'en')).toBeNull()
    expect(pick('Fusionsreaktionen', 'de')).toBeNull()
    expect(pick('Fusion Reactions', 'ja')).toBeNull()
  })

  it('uses Noto Sans for Latin Extended, Greek, Cyrillic and symbols', () => {
    expect(pick('A + B → C')).toBe('latin')
    expect(pick('Reakcje syntezy jądrowej', 'pl')).toBe('latin')
    expect(pick('Реакции синтеза', 'ru')).toBe('latin')
    expect(pick('Реакції синтезу', 'uk')).toBe('latin')
    expect(pick('ν')).toBe('latin')
  })

  it('maps kana to JP and Hangul to KR', () => {
    expect(pick('核融合反応', 'ja')).toBe('jp')
    expect(pick('カタカナ', 'zh')).toBe('jp')
    expect(pick('핵융합 반응', 'ko')).toBe('kr')
  })

  it('disambiguates Han by UI language', () => {
    expect(pick('核聚变反应', 'zh')).toBe('sc')
    expect(pick('核聚变反应', 'zh-CN')).toBe('sc')
    expect(pick('核融合', 'ja')).toBe('jp')
    expect(pick('核融合', 'ja-JP')).toBe('jp')
    expect(pick('核融合', 'en')).toBe('sc')
    expect(pick('核融合', undefined)).toBe('sc')
  })

  it('maps Devanagari and Arabic to their fonts', () => {
    expect(pick('संलयन अभिक्रियाएँ', 'hi')).toBe('devanagari')
    expect(pick('تفاعلات الاندماج', 'ar')).toBe('arabic')
  })

  it('prioritises complex scripts when mixed', () => {
    expect(pick('اندماج 核 → x')).toBe('arabic')
    expect(pick('संलयन 핵')).toBe('devanagari')
    expect(pick('핵 カ 核')).toBe('kr')
  })

  it('declares shaping support per font', () => {
    expect(PDF_FONTS.arabic.shaping).toBe('jspdf-arabic')
    expect(PDF_FONTS.devanagari.shaping).toBe('unshaped')
  })
})

describe('loadPdfFont', () => {
  const spec: PdfFontSpec = PDF_FONTS.latin
  beforeEach(() => clearPdfFontCache())

  it('fetches from /fonts/pdf/ and returns base64', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(new Uint8Array([1, 2, 3, 250])))
    await expect(loadPdfFont(spec, fetchMock)).resolves.toBe(btoa(String.fromCharCode(1, 2, 3, 250)))
    expect(fetchMock).toHaveBeenCalledWith('/fonts/pdf/NotoSans-Regular.ttf')
  })

  it('caches the font for the session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(new Uint8Array([7])))
    const [a, b] = await Promise.all([loadPdfFont(spec, fetchMock), loadPdfFont(spec, fetchMock)])
    await loadPdfFont(spec, fetchMock)
    expect(a).toBe(b)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('caches per font file', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(new Uint8Array([7])))
    await loadPdfFont(PDF_FONTS.latin, fetchMock)
    await loadPdfFont(PDF_FONTS.jp, fetchMock)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects on HTTP errors and evicts the cache so a retry can succeed', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce(okResponse(new Uint8Array([9])))
    await expect(loadPdfFont(spec, fetchMock)).rejects.toThrow('HTTP 404')
    await expect(loadPdfFont(spec, fetchMock)).resolves.toBe(btoa('\x09'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects on network errors', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(loadPdfFont(spec, fetchMock)).rejects.toThrow('Failed to fetch')
  })
})

describe('arrayBufferToBase64', () => {
  it('handles buffers larger than one chunk', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 256)
    expect(arrayBufferToBase64(bytes.buffer)).toBe(Buffer.from(bytes).toString('base64'))
  })
})

describe('applyPdfFont', () => {
  beforeEach(() => clearPdfFontCache())

  it('stays on Helvetica without fetching for Latin-1 text', async () => {
    const doc = fakeDoc()
    const fetchMock = vi.fn()
    const res = await applyPdfFont(doc, ['Hello'], 'ja', fetchMock)
    expect(res).toEqual({ font: 'helvetica', spec: null, fallback: false })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(doc.addFont).not.toHaveBeenCalled()
  })

  it('registers the font for all styles once and selects it', async () => {
    const doc = fakeDoc()
    const fetchMock = vi.fn().mockResolvedValue(okResponse(new Uint8Array([1])))
    const res = await applyPdfFont(doc, ['Привет'], 'ru', fetchMock)
    expect(res).toEqual({ font: 'NotoSansPdf', spec: PDF_FONTS.latin, fallback: false })
    expect(doc.addFileToVFS).toHaveBeenCalledWith('NotoSans-Regular.ttf', btoa('\x01'))
    expect(doc.fonts.NotoSansPdf).toEqual(['normal', 'bold', 'italic', 'bolditalic'])
    expect(doc.setFont).toHaveBeenLastCalledWith('NotoSansPdf', 'normal')

    // Same doc again: no duplicate registration, no second fetch
    await applyPdfFont(doc, ['→'], 'en', fetchMock)
    expect(doc.addFont).toHaveBeenCalledTimes(4)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to Helvetica when the font cannot be fetched', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const doc = fakeDoc()
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'))
    const res = await applyPdfFont(doc, ['核融合'], 'ja', fetchMock)
    expect(res).toEqual({ font: 'helvetica', spec: PDF_FONTS.jp, fallback: true })
    expect(doc.setFont).toHaveBeenLastCalledWith('helvetica', 'normal')
    expect(doc.addFont).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('normalizePdfText', () => {
  it('composes to NFC and strips emoji variation selectors', () => {
    expect(normalizePdfText('Cafe\u0301 \u26A0\uFE0F')).toBe('Café \u26A0')
  })
})

describe('toLatin1Fallback', () => {
  it('replaces common symbols with ASCII and keeps Latin-1', () => {
    expect(toLatin1Fallback('A + B → C + ν')).toBe('A + B -> C + nu')
    expect(toLatin1Fallback('e⁻ x² Größe')).toBe('e- x² Größe')
  })

  it('leaves unknown characters untouched', () => {
    expect(toLatin1Fallback('核')).toBe('核')
  })
})

describe('shipped font files', () => {
  const fontBase64 = (spec: PdfFontSpec) => readFileSync(`${FONT_DIR}${spec.file}`).toString('base64')

  function cmapOf(spec: PdfFontSpec): Record<string, number> {
    const doc = new jsPDF()
    doc.addFileToVFS(spec.file, fontBase64(spec))
    doc.addFont(spec.file, spec.family, 'normal')
    doc.setFont(spec.family, 'normal')
    const font = doc.getFont() as unknown as { metadata: { cmap: { unicode: { codeMap: Record<string, number> } } } }
    return font.metadata.cmap.unicode.codeMap
  }

  it.each(Object.values(PDF_FONTS))('$file is parseable by jsPDF and renders text', (spec) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    doc.addFileToVFS(spec.file, fontBase64(spec))
    doc.addFont(spec.file, spec.family, 'normal')
    doc.setFont(spec.family, 'normal')
    doc.text('Fusion Reactions (A + B → C) ν β⁻ ² Привет', 14, 15)
    expect(doc.output().length).toBeGreaterThan(1000)
  })

  it('every font covers the shared Latin/Greek/Cyrillic/symbol base', () => {
    const required = 'AZaz09 →←↔±≤≥−×²³⁻⁺νβαγμ ĄąŁłŚśŻżÄöüßÇçÑñ АЯаяЁёҐґЄєІіЇї'
    for (const spec of Object.values(PDF_FONTS)) {
      const cmap = cmapOf(spec)
      const missing = [...required].filter((ch) => !cmap[ch.codePointAt(0)!])
      expect(missing, spec.file).toEqual([])
    }
  })

  it('Arabic font keeps the presentation forms jsPDF shapes into', () => {
    const cmap = cmapOf(PDF_FONTS.arabic)
    // seen initial, lam-alef ligature, meem final (produced by jsPDF.processArabic for "سلام")
    for (const cp of [0xfeb3, 0xfefc, 0xfee1]) expect(cmap[cp], cp.toString(16)).toBeTruthy()
  })

  // If this fails after editing a locale file, rebuild the fonts:
  //   bash scripts/fetch-pdf-fonts.sh
  it.each(['en', 'de', 'es', 'fr', 'it', 'pt', 'pl', 'ru', 'uk', 'ja', 'zh', 'ko', 'hi', 'ar'])(
    'the font selected for %s covers every character in its locale file',
    (locale) => {
      const strings = localeStrings(locale)
      const spec = selectPdfFont(detectScripts(strings), locale)
      if (!spec) return // pure Latin-1 -> Helvetica
      const cmap = cmapOf(spec)
      const missing = new Set<string>()
      for (const s of strings) {
        for (const ch of s) {
          const cp = ch.codePointAt(0)!
          if (cp < 0x20 || ch.trim() === '') continue
          if (!cmap[cp]) missing.add(ch)
        }
      }
      expect([...missing].join(''), `${spec.file} missing glyphs for ${locale}`).toBe('')
    },
  )
})
