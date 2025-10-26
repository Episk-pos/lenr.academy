# Database Troubleshooting Guide

## Error: "file is not a database"

This error occurs when the cached database in IndexedDB becomes corrupted.

### Quick Fix

The application now automatically detects and clears corrupted cache. Simply **refresh your browser** and it will:

1. ✅ Detect corrupted cache
2. ✅ Clear invalid data
3. ✅ Download fresh database
4. ✅ Continue normally

---

## Manual Cache Clearing (If Needed)

If the auto-recovery doesn't work, manually clear the cache:

### Method 1: Clear Site Data (Chrome/Edge)

1. Open DevTools: `F12` or `Ctrl+Shift+I`
2. Go to **Application** tab
3. Click **Storage** in left sidebar
4. Click **Clear site data** button
5. Refresh page: `Ctrl+Shift+R`

### Method 2: Clear IndexedDB Only

1. Open DevTools: `F12`
2. Go to **Application** tab
3. Expand **IndexedDB** in left sidebar
4. Right-click **lenr-parkhomov-db**
5. Click **Delete database**
6. Refresh page: `Ctrl+Shift+R`

### Method 3: JavaScript Console

```javascript
// Open console (F12) and run:
indexedDB.deleteDatabase('lenr-parkhomov-db');
location.reload();
```

---

## What We Fixed

### Automatic Corruption Detection

**Added to `src/services/database.ts`:**

```typescript
// Validate cached database
try {
  db = new SQL.Database(cachedDB.data);
  
  // Run validation query
  const result = db.exec('SELECT name FROM sqlite_master WHERE type="table" LIMIT 1');
  if (!result || result.length === 0) {
    throw new Error('Cached database is corrupted');
  }
  
  console.log('✅ Loaded database from cache');
} catch (loadError) {
  console.warn('⚠️ Cached database is corrupted, clearing cache');
  await clearOldVersions();  // Auto-clear corrupted cache
  db = null;
  // Falls through to download fresh database
}
```

### Validation After Download

```typescript
// Validate downloaded database before caching
db = new SQL.Database(data);
const result = db.exec('SELECT name FROM sqlite_master WHERE type="table" LIMIT 1');
if (!result || result.length === 0) {
  throw new Error('Downloaded database appears to be invalid');
}
```

---

## Why This Happens

**Common causes:**
1. **Browser crash** during database download
2. **Storage quota** exceeded mid-write
3. **Browser updates** that clear partial data
4. **Disk errors** during IndexedDB write
5. **Extensions** interfering with IndexedDB

---

## Prevention

### The Fix Prevents Future Issues:

✅ **Validates cache before use** - Corrupted data is detected immediately

✅ **Auto-clears bad cache** - No manual intervention needed

✅ **Validates downloads** - Won't cache invalid data

✅ **Graceful fallback** - Downloads fresh copy automatically

---

## Console Messages

### Normal Flow (No Corruption):
```
🔄 Initializing database...
💾 Found cached database version: 1.2.2
✅ Loaded database from cache
✅ Database ready!
```

### Recovery Flow (Corruption Detected):
```
🔄 Initializing database...
💾 Found cached database version: 1.2.2
⚠️ Cached database is corrupted, clearing cache
📥 No cached database found, downloading...
⬇️ Downloading Parkhomov database...
✅ Parkhomov database loaded successfully
✅ Database ready!
```

---

## Verification

After the fix, your database should load successfully. Check console for:

✅ **No "file is not a database" errors**

✅ **Database operations work correctly**

✅ **Cascade simulations run successfully**

---

## Testing the Fix

1. **Refresh browser**: `Ctrl+Shift+R` (hard refresh)
2. **Check console**: Should see database loading messages
3. **Test cascades**: Try running a simulation
4. **Verify queries**: Check that element data loads

---

## If Still Having Issues

### 1. Verify Database File

Check if database file exists:
```bash
# In project root
ls -lh public/parkhomov.db
# Should show: ~154 MB
```

### 2. Check Browser Console

Look for error messages:
- Open DevTools: `F12`
- Go to **Console** tab
- Look for red error messages
- Share with development team

### 3. Try Different Browser

Test in:
- Chrome/Edge (Chromium)
- Firefox
- Safari

If it works in one browser but not another, it's a browser-specific issue.

### 4. Check Storage Quota

```javascript
// Run in console
navigator.storage.estimate().then(estimate => {
  console.log(`Used: ${estimate.usage} bytes`);
  console.log(`Quota: ${estimate.quota} bytes`);
  console.log(`Available: ${estimate.quota - estimate.usage} bytes`);
});
```

Need at least 200 MB available for database.

---

## Technical Details

### Database Specifications

- **Format**: SQLite 3.x
- **Size**: ~154 MB (uncompressed)
- **Tables**: 5 main tables
  - NuclidesPlus
  - ElementPropertiesPlus
  - FusionReactions
  - FissionReactions
  - TwoToTwoReactions

### Storage Location

- **Browser**: IndexedDB
- **Database Name**: `lenr-parkhomov-db`
- **Object Store**: `databases`
- **Fallback**: Downloads from `/parkhomov.db`

### Caching Strategy

1. **First load**: Downloads from server
2. **Subsequent loads**: Loads from IndexedDB
3. **Background updates**: Checks for new versions
4. **Validation**: Ensures data integrity

---

## Build & Deploy

If you modified the database service:

```bash
# Build the project
npm run build

# Test locally
npm run preview

# Verify database loads
# Check browser console for validation messages
```

---

## Status

**Issue**: ❌ "file is not a database" errors

**Root Cause**: Corrupted IndexedDB cache

**Fix Applied**: ✅ Automatic validation and recovery

**Testing**: ⏳ Pending user verification

**Result**: Should resolve automatically on next page load

---

## Summary

The database loading system now:

1. ✅ **Validates cached data** before using it
2. ✅ **Auto-clears corruption** when detected
3. ✅ **Downloads fresh copy** automatically
4. ✅ **Validates downloads** before caching
5. ✅ **Provides clear console logs** for debugging

**No manual intervention needed** - the system self-heals! 🎉

