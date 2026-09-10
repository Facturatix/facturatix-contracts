/**
 * Every documentation path this repository names points at something (audit B4).
 *
 * Three `docs/ops/*.md` files were cited fifteen times across the platform's workflows, deploy
 * scripts and source comments — one of them in the message an operator reads when the production
 * smoke test fails — and none of the three existed in any repository. Nothing noticed for months,
 * because nothing checks a citation: it is a string in a comment, and a string in a comment
 * compiles.
 *
 * This package has no `docs/` directory today, which is exactly why the check is here: the first
 * citation someone writes is the one that would go unverified. The rule has two halves, because
 * the platform is six repositories and a citation legitimately crosses them:
 *
 * - A bare path — `docs/ops/DESPLIEGUE.md` — means "in this repository", and the file must be here.
 * - A path that starts with a repository name — `facturatix-api/docs/ops/VARIABLES.md` — is
 *   somewhere else, and this script cannot open it. What it can do is insist the repository name
 *   is one of the six, so a reader knows where to look and a typo is caught here rather than by
 *   the person who goes looking.
 *
 * The other repositories assert the same rule as a unit test, next to whichever test already reads
 * a file the compiler ignores. This one has no unit-test runner, so it runs from `pnpm run verify`.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The six repositories a citation may point into. */
const REPOSITORIES = new Set([
  'facturatix-api',
  'facturatix-generator',
  'facturatix-web-app',
  'facturatix-landing',
  'facturatix-modeler',
  'facturatix-contracts'
])

/** A documentation path, with the repository that owns it when it is not this one. */
const CITATION = /(?:([A-Za-z0-9-]+)\/)?(docs\/[A-Za-z0-9_./-]+\.md)/g

/** Where a citation can be written: everything a human edits and a build reads. */
const SCANNED = new Set([
  '.md',
  '.yml',
  '.yaml',
  '.sh',
  '.ts',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.cs',
  '.csproj',
  '.example'
])

/** Directories that are not this repository's writing. */
const SKIPPED = new Set(['.git', 'node_modules', 'dist', 'out', 'bin', 'obj', 'nupkg', 'coverage'])

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const thisFile = fileURLToPath(import.meta.url)

function textFiles(directory) {
  const found = []

  for (const entry of readdirSync(directory)) {
    if (SKIPPED.has(entry)) continue

    const full = join(directory, entry)

    if (statSync(full).isDirectory()) {
      found.push(...textFiles(full))
      continue
    }

    const extension = entry.slice(entry.lastIndexOf('.'))
    if (SCANNED.has(extension) || entry === 'Dockerfile') found.push(full)
  }

  return found
}

const failures = []

for (const file of textFiles(root)) {
  // This file carries the pattern and the examples in its own comments.
  if (file === thisFile) continue

  const contents = readFileSync(file, 'utf8')
  CITATION.lastIndex = 0

  let match
  while ((match = CITATION.exec(contents)) !== null) {
    const [text, repository, path] = match
    const where = relative(root, file).split(sep).join('/')

    if (repository === undefined) {
      if (!existsSync(join(root, path))) {
        failures.push(`${where} cites ${path}, which does not exist in this repository.`)
      }
      continue
    }

    if (!REPOSITORIES.has(repository)) {
      failures.push(`${where} cites ${text}, and ${repository} is not one of the six repositories.`)
    }
  }
}

if (failures.length > 0) {
  console.error('Broken documentation citations:\n')
  for (const failure of failures) console.error(`  - ${failure}`)
  console.error(
    '\nA path named in a workflow, a script or a comment is a promise to whoever follows it.'
  )
  process.exit(1)
}

console.log(
  'Documentation citations OK — every path resolves or names the repository that owns it.'
)
