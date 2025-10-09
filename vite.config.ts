import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'child_process'

// Get version information at build time
function getVersion(): string {
  try {
    // Try to get git version
    const gitVersion = execSync('git describe --tags --always --dirty', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim()
    return gitVersion
  } catch (error) {
    // Fallback to package.json version if git is not available
    try {
      const packageJson = require('./package.json')
      return `v${packageJson.version}`
    } catch {
      return 'unknown'
    }
  }
}

function getBuildTime(): string {
  return new Date().toISOString()
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(getVersion()),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(getBuildTime()),
  },
})
