# Troubleshooting Guide

This guide helps resolve common issues when using LENR Academy.

## Table of Contents

- [Module Loading Errors (Safari/iOS)](#module-loading-errors-safariios)
- [Database Loading Issues](#database-loading-issues)
- [Performance Problems](#performance-problems)
- [Getting Help](#getting-help)

---

## Module Loading Errors (Safari/iOS)

### Error: "Importing a module script failed"

**Issue ID:** [#109](https://github.com/Episk-pos/lenr.academy/issues/109)

**Symptoms:**
- Error message: "Importing a module script failed"
- Error message: "Failed to load database module"
- Application fails to load or crashes on startup
- Most common on Safari (especially iOS 15-18)

**Root Cause:**

This error occurs when Safari's content blockers or browser extensions prevent JavaScript modules from loading. This is a client-side issue affecting approximately 0.6% of users, primarily those using:
- Safari content blockers
- Ad blocking extensions (AdBlock, AdGuard, etc.)
- Network-level ad blockers (Pi-hole, NextDNS, etc.)
- iCloud Private Relay in certain configurations

**Solutions (in order of effectiveness):**

1. **Disable Safari Content Blockers**
   - **iOS:** Settings → Safari → Content Blockers → Toggle off all blockers
   - **macOS:** Safari → Settings → Websites → Content Blockers → Select "Off" for lenr.academy

2. **Disable Browser Extensions**
   - Temporarily disable AdBlock, uBlock Origin, or similar extensions
   - Whitelist lenr.academy in your ad blocker settings

3. **Try Private Browsing Mode**
   - Private mode often disables extensions automatically
   - iOS: Tap the tabs button, then "Private"
   - macOS: File → New Private Window

4. **Check iCloud Private Relay**
   - Settings → [Your Name] → iCloud → Private Relay
   - Try toggling it off temporarily for lenr.academy

5. **Clear Safari Cache**
   - **iOS:** Settings → Safari → Clear History and Website Data
   - **macOS:** Safari → Settings → Privacy → Manage Website Data → Remove All

6. **Use an Alternative Browser**
   - Try Chrome, Firefox, or Edge if the issue persists
   - These browsers have better ES module support and fewer conflicts

**Prevention:**

To avoid this issue in the future:
- Add lenr.academy to your content blocker's whitelist
- Use browser extensions' "whitelist" or "allowed sites" feature
- Report persistent issues to your content blocker's developer

**For Developers:**

Recent changes to improve compatibility (Issue #109 fixes):
- Added explicit browser targets: `['es2020', 'safari14']`
- Enabled module preload polyfill in Vite config
- Enhanced error handling with user-friendly messages
- Added Sentry tracking for diagnostic data

---

## Database Loading Issues

### Database Download Stuck or Slow

**Symptoms:**
- Progress bar stops at a certain percentage
- Download takes longer than 2-3 minutes
- Network timeout errors

**Solutions:**

1. **Check Network Connection**
   - Ensure you have a stable internet connection
   - The database is 161MB - it will take time on slow connections
   - Cellular data users: expect 2-5 minute download on 4G/5G

2. **Clear IndexedDB Cache**
   - Open browser DevTools (F12)
   - Application/Storage tab → IndexedDB
   - Delete "lenr-academy-db"
   - Refresh the page

3. **Disable VPN/Proxy**
   - Some VPN configurations interfere with large downloads
   - Try disabling temporarily for the initial database download

4. **Check Browser Storage Quota**
   - The app needs ~200MB of storage space
   - Check available storage: Settings → Storage (varies by browser)

### Database Corruption Error

**Symptoms:**
- Error: "file is not a database"
- Application works initially, then fails on subsequent loads

**Solution:**

The app provides a one-click fix for this issue:

1. When you see the error, click **"Clear Cache & Reload"** button
2. This will:
   - Clear the corrupted IndexedDB cache
   - Reload the page
   - Re-download the fresh database (161MB)

**Prevention:**
- Don't close the browser during database download
- Don't manually modify IndexedDB data
- Keep browser updated to latest version

---

## Performance Problems

### Slow Query Results

**Symptoms:**
- Query takes more than 5 seconds to execute
- Browser becomes unresponsive during queries
- Results take a long time to render

**Solutions:**

1. **Reduce Result Limit**
   - Use the limit selector to reduce results (500 → 100 or fewer)
   - Smaller result sets render much faster

2. **Use More Specific Filters**
   - Add element filters to narrow results
   - Use MeV range filters to reduce result count
   - Select fewer elements from the periodic table

3. **Close Background Tabs**
   - The database runs in browser memory
   - Other tabs compete for resources
   - Close unnecessary tabs before running large queries

4. **Use Desktop Instead of Mobile**
   - Desktop browsers have more memory and CPU
   - Better for queries returning >1000 results

5. **Check System Resources**
   - Close other applications
   - Ensure sufficient RAM available (recommend 4GB+ free)

### Page Crashes or "Out of Memory" Errors

**Solutions:**

1. **Reduce Query Scope**
   - Decrease result limit to 100 or less
   - Use more specific element selections

2. **Restart Browser**
   - Close all tabs and reopen
   - This clears memory leaks

3. **Update Browser**
   - Ensure you're on the latest browser version
   - Newer versions have better memory management

---

## Getting Help

If you've tried the solutions above and still experience issues:

### Search Existing Issues

Before reporting a new issue, search for similar problems:

🔍 **[Search GitHub Issues](https://github.com/Episk-pos/lenr.academy/issues)**

### Report a New Issue

If you can't find a solution:

1. Click the **"Search Similar Issues"** button in the error display
2. If no matches found, click **"Report This Error"**
3. The error details will be copied to your clipboard
4. Paste them in the GitHub issue template
5. Add your reproduction steps

### Community Support

💬 **[GitHub Discussions](https://github.com/Episk-pos/lenr.academy/discussions)** - Ask questions, share experiences

### Technical Details

When reporting issues, include:
- Browser name and version
- Operating system
- Device type (desktop/mobile/tablet)
- Network type (WiFi/cellular)
- Content blockers or extensions installed
- Steps to reproduce the issue
- Error fingerprint (shown in error display)

---

## Browser Compatibility

### Officially Supported Browsers

✅ **Fully Supported:**
- Chrome 107+
- Edge 107+
- Firefox 104+
- Safari 14+ (iOS 14+)

⚠️ **Partial Support:**
- Safari 11-13 (some features may not work)
- iOS 11-13 (slower performance, possible issues)

❌ **Not Supported:**
- Internet Explorer (any version)
- Safari <11
- iOS <11

### Browser-Specific Notes

**Safari/iOS:**
- May require disabling content blockers (see above)
- Service worker updates may require manual refresh
- Private Relay can interfere with downloads

**Firefox:**
- IndexedDB quota prompts may appear on first load
- Grant persistent storage for best experience

**Chrome/Edge:**
- Best performance and compatibility
- Recommended for queries with large result sets

---

## FAQ

### Why is the initial load so slow?

The 161MB database must be downloaded on first visit. This is a one-time download - subsequent visits load from cache instantly.

### Can I use this offline?

Yes! After the initial database download, the app works fully offline. The database is cached in IndexedDB.

### How much storage does this use?

Approximately 200MB total:
- 161MB database file
- ~30MB application code and assets
- ~10MB for IndexedDB overhead

### Does this work on mobile?

Yes, but desktop is recommended for:
- Large query result sets (>500 rows)
- Better performance
- Easier data analysis

### Is my data private?

Yes:
- All queries run in your browser (client-side)
- No query data sent to servers
- Only anonymous error reports sent to Sentry (if consented)
- No tracking cookies or personal data collection

---

**Last Updated:** 2025-11-20
**Related Issues:** [#109](https://github.com/Episk-pos/lenr.academy/issues/109)
