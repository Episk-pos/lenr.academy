#!/usr/bin/env node

/**
 * Download database from db.lenr.academy
 * Cross-platform Node.js script (works on Windows, macOS, Linux)
 * Usage:
 *   node scripts/download-db.js           # Downloads latest version
 *   node scripts/download-db.js v1.2.3  # Downloads specific version
 */

import { existsSync, mkdirSync, createWriteStream, unlinkSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const publicDir = join(projectRoot, 'public');
const dbPath = join(publicDir, 'parkhomov.db');
const metaPath = join(publicDir, 'parkhomov.db.meta.json');

const VERSION = process.argv[2] || 'latest';
const BASE_URL = 'https://db.lenr.academy';

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

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    log(`  Downloading ${url}...`, 'blue');
    
    const file = createWriteStream(outputPath);
    let downloadedBytes = 0;
    let totalBytes = 0;
    
    // Handle file write errors (disk full, permission denied, etc.)
    file.on('error', (err) => {
      // Close the file stream and wait for 'close' event before deleting
      // On Windows, you cannot delete an open file, so we must wait for close
      file.close();
      file.once('close', () => {
        if (existsSync(outputPath)) {
          try {
            unlinkSync(outputPath);
          } catch (unlinkErr) {
            // Ignore unlink errors
          }
        }
        reject(new Error(`Failed to write file: ${err.message}`));
      });
    });
    
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        // Destroy the response stream to prevent resource leaks
        response.destroy();
        // Close the file stream and wait for 'close' event before deleting
        // On Windows, you cannot delete an open file, so we must wait for close
        file.close();
        file.once('close', () => {
          if (existsSync(outputPath)) {
            try {
              unlinkSync(outputPath);
            } catch (unlinkErr) {
              // Ignore unlink errors
            }
          }
          reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        });
        return;
      }
      
      totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          const percentage = ((downloadedBytes / totalBytes) * 100).toFixed(1);
          process.stdout.write(`\r  Progress: ${percentage}% (${(downloadedBytes / 1024 / 1024).toFixed(1)}MB / ${(totalBytes / 1024 / 1024).toFixed(1)}MB)`);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        // Close the file stream and wait for 'close' event before resolving
        // This ensures the file descriptor is fully closed and data is flushed to disk
        // before the promise resolves, preventing issues with subsequent file operations
        file.close();
        file.once('close', () => {
          if (totalBytes > 0) {
            process.stdout.write('\n');
          }
          resolve();
        });
      });
    }).on('error', (err) => {
      // Close the file stream and wait for 'close' event before deleting
      // On Windows, you cannot delete an open file, so we must wait for close
      file.close();
      file.once('close', () => {
        if (existsSync(outputPath)) {
          try {
            unlinkSync(outputPath);
          } catch (unlinkErr) {
            // Ignore unlink errors
          }
        }
        reject(err);
      });
    });
  });
}

async function downloadDatabase() {
  log(`\nDownloading database version: ${VERSION}`, 'yellow');
  console.log('');
  
  // Ensure public directory exists
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
  }
  
  try {
    // Download database
    const dbUrl = `${BASE_URL}/${VERSION}/parkhomov.db`;
    await downloadFile(dbUrl, dbPath);
    log('  ✓ Database downloaded', 'green');
    
    // Download metadata
    const metaUrl = `${BASE_URL}/${VERSION}/parkhomov.db.meta.json`;
    await downloadFile(metaUrl, metaPath);
    log('  ✓ Metadata downloaded', 'green');
    
    console.log('');
    log('Database download complete!', 'green');
    console.log('');
    
    // Show metadata
    if (existsSync(metaPath)) {
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
        log('Database info:', 'blue');
        console.log(JSON.stringify(meta, null, 2));
        console.log('');
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
    
    log(`Location: ${dbPath}`, 'blue');
    log('Ready for development: npm run dev', 'blue');
    console.log('');
  } catch (error) {
    log('\nDatabase download failed', 'red');
    log(`  Error: ${error.message}`, 'red');
    console.log('');
    log('You can manually download the database:', 'yellow');
    log(`  1. Visit: ${BASE_URL}/${VERSION}/parkhomov.db`, 'yellow');
    log('  2. Save the file to public/parkhomov.db', 'yellow');
    console.log('');
    process.exit(1);
  }
}

downloadDatabase();

