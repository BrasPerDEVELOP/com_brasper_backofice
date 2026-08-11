import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const root = new URL('../src/', import.meta.url)
const sourceRoot = root.pathname
const sourceExtensions = new Set(['.ts', '.vue'])
const forbidden = [
  /Domain\.apiPath\(\s*(['"`])[^'"`\n]*\/\1\s*\)/g,
  /new\s+Adapter(?:<[^>]+>)?\(\s*(['"`])[^'"`\n]*\/\1/g,
  /apiClient\.(?:get|post|put|patch|delete)(?:<[^>]+>)?\(\s*(['"`])[^'"`\n]*\/\1/g,
  /const\s+[A-Z0-9_]*(?:API|ENDPOINT)[A-Z0-9_]*\s*=\s*(['"`])[^'"`\n]*\/\1/g
]

function files(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry)
    return statSync(fullPath).isDirectory() ? files(fullPath) : [fullPath]
  })
}

const violations = []
for (const file of files(sourceRoot).filter((item) => sourceExtensions.has(extname(item)))) {
  const content = readFileSync(file, 'utf8')
  for (const pattern of forbidden) {
    pattern.lastIndex = 0
    for (const match of content.matchAll(pattern)) {
      const line = content.slice(0, match.index).split('\n').length
      violations.push(`${relative(sourceRoot, file)}:${line}: ${match[0]}`)
    }
  }
}

if (violations.length) {
  console.error('URLs API no canónicas (barra final) detectadas:\n' + violations.join('\n'))
  process.exit(1)
}

console.log('URLs API canónicas: OK')
