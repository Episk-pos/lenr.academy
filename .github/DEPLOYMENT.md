# Deployment Guide

## Automated Deployment (GitHub Actions)

LENR Academy automatically deploys to production when a **non-prerelease** release is published on GitHub.

### How It Works

1. Create and publish a new release on GitHub (not marked as pre-release)
2. GitHub Actions triggers the `deploy.yml` workflow
3. Workflow builds the production bundle and deploys to AWS S3 + CloudFront
4. Site is live at https://lenr.academy within minutes

### Required GitHub Secrets

The following secrets must be configured in your repository settings at `Settings > Secrets and variables > Actions`:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key with S3 and CloudFront permissions | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | AWS region for CloudFront | `us-east-1` |

### Required AWS Permissions

The IAM user/role needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::lenr.academy",
        "arn:aws:s3:::lenr.academy/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation"
      ],
      "Resource": "arn:aws:cloudfront::*:distribution/ET0385Q49O8YX"
    }
  ]
}
```

## Manual Deployment (Local)

If you need to deploy manually from your local machine:

```bash
# Build and deploy
npm run deploy

# Or run steps individually
npm run build
npm run deploy:s3
npm run deploy:uncache
```

**Requirements:**
- AWS CLI configured with credentials (`aws configure`)
- Permissions listed above

## Deployment Checklist

Before creating a release:

- [ ] All changes merged to main branch
- [ ] `npm run build` completes successfully locally
- [ ] `npm run lint` passes
- [ ] `npm run test:e2e` passes (if E2E tests exist)
- [ ] Version bumped in `package.json`
- [ ] `CLAUDE.md` updated if architecture changed
- [ ] Database version in `public/parkhomov.db.meta.json` matches deployed database
- [ ] Release notes prepared

## Release Process

1. **Bump version** in `package.json`
2. **Commit changes**: `git commit -am "chore: bump version to X.Y.Z"`
3. **Create Git tag**: `git tag vX.Y.Z`
4. **Push tag**: `git push origin vX.Y.Z`
5. **Create GitHub Release**:
   - Go to https://github.com/Episk-pos/lenr.academy/releases/new
   - Select the tag you just created
   - Add release title (e.g., "v1.2.0 - Database Optimization")
   - Add release notes
   - **DO NOT** check "Set as a pre-release"
   - Click "Publish release"
6. **Monitor deployment**: Check the Actions tab for deployment status

## Pre-release Testing

To test changes without triggering production deployment:

1. Mark release as "pre-release" when publishing
2. Deploy manually from your local machine
3. Test on staging/preview environment
4. When ready, create a new non-prerelease release

## Rollback

If a deployment causes issues:

1. **Quick rollback**: Create a new release from the previous working tag
2. **Manual rollback**:
   ```bash
   git checkout <previous-tag>
   npm run build
   npm run deploy
   ```

## Troubleshooting

### Deployment fails with AWS credentials error
- Verify secrets are correctly set in GitHub repository settings
- Check IAM permissions match the policy above
- Ensure `AWS_REGION` is set (typically `us-east-1`)

### CloudFront invalidation fails
- Verify distribution ID `ET0385Q49O8YX` is correct
- Check IAM user has `cloudfront:CreateInvalidation` permission
- Invalidations are limited to 3000 per month (AWS free tier)

### Build fails in GitHub Actions
- Run `npm run build` locally to reproduce
- Check for TypeScript errors (`npm run lint`)
- Ensure all dependencies are in `package.json` (not just `devDependencies`)

### Changes not appearing after deployment
- Wait 5-10 minutes for CloudFront cache invalidation to propagate
- Check CloudFront invalidation status in AWS Console
- Hard refresh browser (Ctrl+F5 or Cmd+Shift+R)
- Verify deployment completed successfully in Actions tab

## Architecture

**Deployment Stack:**
- **Source**: GitHub repository
- **CI/CD**: GitHub Actions
- **Build**: Vite (React + TypeScript)
- **Storage**: AWS S3 (`s3://lenr.academy`)
- **CDN**: AWS CloudFront (distribution `ET0385Q49O8YX`)
- **Domain**: lenr.academy

**Build Output:**
- Location: `./dist/`
- Size: ~2MB (excluding 161MB database file)
- Contents: HTML, JS, CSS, assets, database files

**Cache Strategy:**
- CloudFront caches all assets
- Invalidation on `/*` ensures fresh content
- Database file (`parkhomov.db`) cached with version metadata
