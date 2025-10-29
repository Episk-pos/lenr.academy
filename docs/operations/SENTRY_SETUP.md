# Sentry Error Tracking Setup Guide

This guide walks you through setting up Sentry error tracking for LENR Academy with automatic source map uploads.

## 🎯 Overview

Sentry is configured to:
- ✅ Track errors in production only
- ✅ Upload source maps automatically on deployment
- ✅ Respect user privacy (no PII, URL scrubbing, EU hosting)
- ✅ Delete source maps from bundle after upload
- ✅ Track release versions via git tags

---

## 📋 Prerequisites

- Sentry account (free tier: 5,000 errors/month)
- GitHub repository admin access (to add secrets)

---

## 🚀 Step-by-Step Setup

### Step 1: Create Sentry Account & Project

1. **Sign up at Sentry**:
   - Visit: https://sentry.io/signup/
   - **Important**: Select **EU region** during signup for GDPR compliance

2. **Create a new project**:
   - Click "Create Project"
   - Platform: **React**
   - Alert frequency: Choose your preference (default is fine)
   - Project name: `lenr-academy` (or your preference)
   - Click "Create Project"

3. **Save your project details**:
   - **Organization slug**: Found in URL `https://sentry.io/organizations/YOUR-ORG/`
   - **Project slug**: Found in project settings or URL
   - **DSN**: Provided after project creation (looks like `https://xxxxx@o000000.ingest.sentry.io/0000000`)

### Step 2: Create Sentry Auth Token

1. Go to: https://sentry.io/settings/account/api/auth-tokens/
2. Click "Create New Token"
3. **Name**: `lenr-academy-ci`
4. **Scopes** (check these):
   - ✅ **Project: Read & Write**
   - ✅ **Release: Admin**
5. Click "Create Token"
6. **Copy the token** (you won't see it again!)

### Step 3: Add GitHub Secrets

Go to your GitHub repository:
```
https://github.com/Episk-pos/lenr.academy/settings/secrets/actions
```

Add the following **Repository Secrets**:

| Secret Name | Value | Where to Find |
|-------------|-------|---------------|
| `VITE_SENTRY_DSN` | Your Sentry DSN | Sentry Project Settings → Client Keys |
| `SENTRY_ORG` | Your organization slug | Sentry URL (e.g., `lenr-academy-org`) |
| `SENTRY_PROJECT` | Your project slug | Sentry project settings (e.g., `lenr-academy`) |
| `SENTRY_AUTH_TOKEN` | Auth token from Step 2 | Token you just created |

**Example**:
```
VITE_SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/7890123
SENTRY_ORG=lenr-academy-org
SENTRY_PROJECT=lenr-academy
SENTRY_AUTH_TOKEN=sntrys_abc123def456... (long token)
```

---

## ✅ Verification

### Test in Production

1. **Deploy a new release**:
   ```bash
   npm run release:alpha
   # Then uncheck "prerelease" on GitHub to trigger deployment
   ```

2. **Check build logs**:
   - Go to GitHub Actions → Deploy to Production
   - Look for Sentry source map upload messages in build step
   - Should see: `Source maps uploaded to Sentry`

3. **Verify in Sentry**:
   - Go to: https://sentry.io/organizations/YOUR-ORG/projects/lenr-academy/
   - Navigate to: Releases
   - Your latest version should appear with source maps

### Test Error Tracking

1. **Trigger a test error**:
   - Visit: https://lenr.academy
   - Open browser console
   - Run: `throw new Error("Test Sentry integration")`

2. **Check Sentry dashboard**:
   - Go to: https://sentry.io/organizations/YOUR-ORG/issues/
   - Your error should appear within seconds
   - Click on it to see full stack trace with file names and line numbers

---

## 🔧 Local Development (Optional)

To test Sentry locally:

1. **Create `.env.local`** (gitignored):
   ```bash
   VITE_SENTRY_DSN=your-dsn-here
   ```

2. **Build and test**:
   ```bash
   npm run build
   npm run serve
   ```

3. **Trigger test error** in browser console:
   ```javascript
   throw new Error("Local test error")
   ```

4. **Note**: In development mode (`npm run dev`), Sentry only logs to console and doesn't send events.

---

## 🔒 Privacy & Security

### What Gets Sent to Sentry

✅ **Sent**:
- Error messages and stack traces
- Browser type and version
- Page URL (scrubbed - only safe params kept)
- Release version (git tag)
- User actions before error (breadcrumbs)

❌ **NOT sent**:
- User IP addresses (`sendDefaultPii: false`)
- Sensitive URL parameters (only `Z` and `A` kept)
- Session replays (disabled except 10% of errors)
- Any personally identifiable information

### Source Maps

- ✅ Uploaded to Sentry for readable stack traces
- ✅ **Deleted from production bundle** (not publicly accessible)
- ✅ Only accessible to your Sentry team
- ✅ Automatically cleaned up after upload

---

## 📊 Monitoring & Alerts

### Sentry Dashboard

Access your errors at:
```
https://sentry.io/organizations/YOUR-ORG/issues/
```

**Features**:
- View all errors with frequency charts
- See which release versions have errors
- Filter by browser, OS, URL
- Set up email/Slack alerts

### Recommended Alerts

1. **Critical Errors**:
   - Navigate to: Alerts → Create Alert
   - Condition: "An event is seen"
   - Filters: "Level equals Error"
   - Action: Email notification

2. **High-Volume Issues**:
   - Condition: "Issue is seen more than 100 times in 1 hour"
   - Action: Slack notification (optional)

---

## 🛠️ Troubleshooting

### Build fails with Sentry error

**Issue**: Build fails with "Unable to upload source maps"

**Solutions**:
1. Check that `SENTRY_AUTH_TOKEN` is set in GitHub secrets
2. Verify token has correct scopes (**Project: Read & Write**, **Release: Admin**)
3. Confirm organization and project slugs are correct

### Errors not appearing in Sentry

**Checklist**:
- [ ] `VITE_SENTRY_DSN` is set in GitHub secrets
- [ ] Deployed version includes Sentry configuration
- [ ] Error occurred in production (not development)
- [ ] Check browser console for Sentry initialization logs

### Source maps not showing file names

**Solutions**:
1. Check that source maps were uploaded:
   ```bash
   # In GitHub Actions logs, look for:
   # "Source maps uploaded to Sentry"
   ```
2. Verify release name matches in Sentry dashboard
3. Ensure build completed successfully
4. Confirm debug IDs are embedded in JavaScript files (check verification step output in GitHub Actions)

### Understanding Source Map Upload

The Vite plugin configuration has been optimized for reliable uploads:

- **Debug mode**: Enabled for verbose logging during builds
- **Asset targeting**: Configured to explicitly target `./dist/assets/**/*.js`
- **URL prefix**: Set to `~/assets` to match production serving path
- **Debug ID approach**: Uses modern debug ID injection instead of filename matching

**Important**: Source map files (`.map`) are automatically **deleted** from `dist/` after upload to Sentry. This is correct and expected behavior:
- Maps are stored securely on Sentry's servers
- JavaScript files contain embedded debug IDs for matching
- `.map` files should NOT appear in S3 or production deployments
- This prevents your source code from being publicly accessible

If you see `.map` files in your production deployment, something is wrong with the build process.

---

## 📚 Additional Resources

- **Sentry React Docs**: https://docs.sentry.io/platforms/javascript/guides/react/
- **Sentry Vite Plugin**: https://github.com/getsentry/sentry-vite-plugin
- **Privacy Features**: https://docs.sentry.io/platforms/javascript/data-management/
- **GDPR Compliance**: https://sentry.io/trust/privacy/

---

## 🔄 Maintenance

### Updating Sentry

```bash
npm update @sentry/react @sentry/vite-plugin
```

### Rotating Auth Token

1. Create new token in Sentry (Step 2)
2. Update `SENTRY_AUTH_TOKEN` in GitHub secrets
3. Delete old token in Sentry

### Changing Organization/Project

Update these GitHub secrets:
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `VITE_SENTRY_DSN`

---

**Questions?** Check the [Sentry documentation](https://docs.sentry.io) or file an issue in the GitHub repository.
