#!/usr/bin/env node

/**
 * Post-install script to download the latest database
 * Runs automatically after npm install
 * Downloads from https://db.lenr.academy (no credentials required)
 */

import { existsSync, mkdirSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const publicDir = join(projectRoot, 'public');
const dbPath = join(publicDir, 'parkhomov.db');
const metaPath = join(publicDir, 'parkhomov.db.meta.json');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
};

// Base URL for database downloads (static website hosting, no credentials required)
const DB_BASE_URL = 'https://db.lenr.academy';

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function downloadWithCurl(url, outputPath) {
  log(`  Downloading from ${url}...`, 'blue');
  const command = `curl -f -L --progress-bar -o "${outputPath}" "${url}"`;
  await execAsync(command);
}

async function downloadDatabase() {
  const skipDbDownload = String(process.env.SKIP_DB_DOWNLOAD || '').toLowerCase();
  if (['1', 'true', 'yes'].includes(skipDbDownload)) {
    log('⏭️  Skipping database download (SKIP_DB_DOWNLOAD set)', 'yellow');
    return;
  }

  const forceMetaDownload = String(process.env.FORCE_DB_META_DOWNLOAD || '').toLowerCase();
  const shouldDownloadMeta =
    !existsSync(metaPath) || ['1', 'true', 'yes'].includes(forceMetaDownload);

  // Check if database already exists
  if (existsSync(dbPath)) {
    log('✓ Database already exists, skipping download', 'green');
    log('  To download the latest version, run: npm run db:download', 'blue');
    return;
  }

  log('\n📦 Downloading database for local development...', 'yellow');

  // Ensure public directory exists
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
  }

  try {
    // Download via HTTPS from db.lenr.academy (no credentials required)
    await downloadWithCurl(`${DB_BASE_URL}/latest/parkhomov.db`, dbPath);
    if (shouldDownloadMeta) {
      await downloadWithCurl(`${DB_BASE_URL}/latest/parkhomov.db.meta.json`, metaPath);
    } else {
      log('  Metadata already tracked, skipping download (set FORCE_DB_META_DOWNLOAD=1 to override)', 'yellow');
    }

    log('\n✅ Database downloaded successfully!', 'green');
    log('  Location: public/parkhomov.db', 'blue');
    log('  Ready for development: npm run dev\n', 'blue');
  } catch (error) {
    log('\n⚠️  Database download failed', 'red');
    log(`  Error: ${error.message}`, 'red');
    log('\n  You can manually download the database:', 'yellow');
    log('    1. Run: npm run db:download', 'yellow');
    log('    2. Or download from: https://db.lenr.academy/', 'yellow');
    log('    3. Place parkhomov.db in the public/ directory\n', 'yellow');

    // Don't fail the install if download fails
    process.exit(0);
  }
}

// Only run if this is being executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  downloadDatabase().catch(error => {
    log(`\n❌ Unexpected error: ${error.message}`, 'red');
    process.exit(0); // Don't fail npm install
  });
}

export { downloadDatabase };
