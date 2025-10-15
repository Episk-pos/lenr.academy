import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { getVersion, getBuildTime } from './version-utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const distDir = join(__dirname, '..', 'dist')
const outputPath = join(distDir, 'version.json')

const versionInfo = {
  version: getVersion(),
  buildTime: getBuildTime(),
}

mkdirSync(distDir, { recursive: true })
writeFileSync(outputPath, JSON.stringify(versionInfo, null, 2))

console.log(`Created version metadata at ${outputPath}`)
