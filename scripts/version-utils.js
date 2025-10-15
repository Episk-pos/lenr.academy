import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

export function getVersion() {
  try {
    const gitVersion = execSync('git describe --tags --always --dirty', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim()
    return gitVersion
  } catch {
    try {
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = dirname(__filename)
      const packageJsonPath = join(__dirname, '..', 'package.json')
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
      return `v${packageJson.version}`
    } catch {
      return 'unknown'
    }
  }
}

export function getBuildTime() {
  return new Date().toISOString()
}

export function getVersionInfo() {
  return {
    version: getVersion(),
    buildTime: getBuildTime(),
  }
}
