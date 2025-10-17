# PWA Icon Requirements

## Required Icons

The following icons need to be created for the PWA:

### Standard Icons
- **icon-192.png** (192x192px) - Minimum PWA requirement
- **icon-512.png** (512x512px) - High-res for app drawer
- **apple-touch-icon.png** (180x180px) - iOS home screen

### Maskable Icons (with safe zone)
- **icon-maskable-192.png** (192x192px) - Safe zone for adaptive icons
- **icon-maskable-512.png** (512x512px) - Safe zone for adaptive icons

## Design Guidelines

### Branding
- Use LENR Academy branding/logo
- Primary color: `#3b82f6` (blue)
- Background: white or transparent

### Maskable Icon Safe Zone
- Keep important content within center 80% circle
- Outer 20% may be cropped on some devices
- Use solid background color for maskable variants

### Style
- Simple, recognizable at small sizes
- High contrast for visibility
- Professional appearance

## Generation Options

### Option 1: Use existing logo
If you have an existing LENR Academy logo:
1. Export as PNG at 512x512px
2. Use image editor or online tool to resize to other dimensions
3. For maskable icons, add padding/background to fit safe zone

### Option 2: Text-based icon
Simple text-based design:
- Text: "LENR" or atomic symbol
- Background: Blue (#3b82f6)
- Text color: White
- Font: Bold, sans-serif

### Option 3: Icon generator tools
Use online PWA icon generators:
- https://realfavicongenerator.net/
- https://favicon.io/
- https://www.pwabuilder.com/imageGenerator

## Placeholder Icons

Temporary placeholder icons are provided as SVG files that can be converted to PNG:
- Use ImageMagick, Inkscape, or online converters
- Command: `convert icon-placeholder.svg -resize 192x192 icon-192.png`
