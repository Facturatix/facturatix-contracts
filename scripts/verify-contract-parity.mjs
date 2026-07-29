/**
 * Verifies that the TypeScript implementation of the recipe contract reproduces the fixture
 * manifest — the same manifest the C# reference implementation generated.
 *
 * This is the check that makes "one contract" a fact rather than an intention. Two hand-written
 * validators in two languages will drift; the only question is whether the drift is discovered by
 * a test or by a modeler whose recipe published locally and was rejected by the server.
 *
 * Run after `pnpm run build`:
 *
 *   node scripts/verify-contract-parity.mjs
 */

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const { validateRecipeDocument, computeHash } = require(
  join(packageRoot, 'dist', 'cjs', 'index.js')
)
const resources = require(join(packageRoot, 'dist', 'cjs', 'contract-resources.js'))

const manifest = resources.readManifest()
const fixtureFiles = resources.listFixtureNames()
const failures = []

// A manifest that lists fewer fixtures than the corpus would let a new fixture ship unverified.
const manifestFiles = manifest.fixtures.map((entry) => entry.file).sort()
if (JSON.stringify(manifestFiles) !== JSON.stringify(fixtureFiles)) {
  failures.push(
    `The manifest lists [${manifestFiles.join(', ')}] but the corpus holds [${fixtureFiles.join(', ')}].`
  )
}

for (const expectation of manifest.fixtures) {
  const json = resources.readFixture(expectation.file)
  const verdict = validateRecipeDocument(json)
  const hash = computeHash(json)

  if (verdict.isValid !== expectation.expectedValid) {
    failures.push(
      `${expectation.file}: expected isValid=${expectation.expectedValid}, got ${verdict.isValid} ` +
        `(${verdict.messages.join(' | ') || 'no issues'})`
    )
  }

  if (JSON.stringify(verdict.codes) !== JSON.stringify(expectation.expectedCodes)) {
    failures.push(
      `${expectation.file}: expected codes [${expectation.expectedCodes.join(', ')}], ` +
        `got [${verdict.codes.join(', ')}]`
    )
  }

  if (hash !== expectation.canonicalHash) {
    failures.push(
      `${expectation.file}: canonical hash mismatch — the C# canonicalizer produced ` +
        `${expectation.canonicalHash}, TypeScript produced ${hash}`
    )
  }
}

if (failures.length > 0) {
  console.error('Contract parity FAILED:\n')
  for (const failure of failures) console.error(`  • ${failure}`)
  process.exit(1)
}

console.log(
  `Contract parity OK — ${manifest.fixtures.length} fixtures agree across C# and TypeScript.`
)
