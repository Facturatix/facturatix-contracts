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

// ── variable catalogue ────────────────────────────────────────────────────────────────────────

// The catalogue closes what the schema's source pattern leaves open — which user fields exist and
// which ticket leaves carry a normalizer — so a mirror that has drifted from the artefact is a
// Modeler offering a field the Generator cannot resolve, or an amount reaching a portal with its
// currency symbol still attached. Compared positionally: order is part of the mirror.
const catalog = resources.readVariableCatalog()
const {
  USER_FIELDS,
  TICKET_VALUE_KINDS,
  TICKET_DEFAULT_VALUE_KIND,
  VARIABLE_CATALOG_VERSION
} = require(join(packageRoot, 'dist', 'cjs', 'variable-catalog.js'))

if (catalog.catalog_version !== VARIABLE_CATALOG_VERSION) {
  failures.push(
    `variable catalogue: the artefact declares version ${catalog.catalog_version}, ` +
      `the TypeScript mirror ${VARIABLE_CATALOG_VERSION}.`
  )
}

const artefactUserFields = JSON.stringify(
  catalog.user_fields.fields.map((f) => [f.source, f.support, f.availability])
)
const mirrorUserFields = JSON.stringify(
  USER_FIELDS.map((f) => [f.source, f.support, f.availability])
)
if (artefactUserFields !== mirrorUserFields) {
  failures.push(
    `variable catalogue user_fields: the artefact holds ${artefactUserFields} but the ` +
      `TypeScript mirror holds ${mirrorUserFields}.`
  )
}

const artefactTicketKinds = JSON.stringify(
  catalog.ticket_fields.value_kinds.map((entry) => [entry.kind, entry.leaves])
)
const mirrorTicketKinds = JSON.stringify(
  TICKET_VALUE_KINDS.map((entry) => [entry.kind, entry.leaves])
)
if (artefactTicketKinds !== mirrorTicketKinds) {
  failures.push(
    `variable catalogue ticket value kinds: the artefact holds ${artefactTicketKinds} but the ` +
      `TypeScript mirror holds ${mirrorTicketKinds}.`
  )
}

if (catalog.ticket_fields.default_value_kind !== TICKET_DEFAULT_VALUE_KIND) {
  failures.push(
    `variable catalogue: the artefact's default ticket value kind is ` +
      `'${catalog.ticket_fields.default_value_kind}', the mirror's is '${TICKET_DEFAULT_VALUE_KIND}'.`
  )
}

if (failures.length > 0) {
  console.error('Contract parity FAILED:\n')
  for (const failure of failures) console.error(`  • ${failure}`)
  process.exit(1)
}

console.log(
  `Contract parity OK — ${manifest.fixtures.length} fixtures agree across C# and TypeScript, ` +
    `and the variable catalogue mirror reproduces its ${catalog.user_fields.fields.length} user ` +
    `fields and ${catalog.ticket_fields.value_kinds.length} ticket value kinds.`
)
