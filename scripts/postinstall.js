#!/usr/bin/env node

/**
 * Post-install script to download the latest database from S3
 * Runs automatically after npm install
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

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkAwsCli() {
  try {
    await execAsync('aws --version');
    return true;
  } catch {
    return false;
  }
}

async function downloadWithCurl(url, outputPath) {
  log(`  Downloading from ${url}...`, 'blue');
  const command = `curl -f -L -o "${outputPath}" "${url}"`;
  await execAsync(command);
}

async function downloadDatabase() {
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

  const hasAwsCli = await checkAwsCli();

  try {
    if (hasAwsCli) {
      // Use AWS CLI if available (faster)
      log('  Using AWS CLI for download...', 'blue');
      await execAsync(`aws s3 cp s3://db.lenr.academy/latest/parkhomov.db "${dbPath}" --no-sign-request`);
      await execAsync(`aws s3 cp s3://db.lenr.academy/latest/parkhomov.db.meta.json "${metaPath}" --no-sign-request`);
    } else {
      // Fallback to HTTPS download via curl
      log('  AWS CLI not found, using HTTPS download...', 'blue');
      log('  (Install AWS CLI for faster downloads)', 'yellow');
      await downloadWithCurl('https://db.lenr.academy.s3.amazonaws.com/latest/parkhomov.db', dbPath);
      await downloadWithCurl('https://db.lenr.academy.s3.amazonaws.com/latest/parkhomov.db.meta.json', metaPath);
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
