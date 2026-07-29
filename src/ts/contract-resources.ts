/**
 * Access to the contract artefacts shipped inside this package: the JSON Schema, the fixture
 * corpus and the fixture manifest.
 *
 * Node-only — it reads from the installed package directory. Consumers that bundle for a browser
 * should import the constants and the validator instead; those have no filesystem dependency.
 *
 * @module
 */

import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

import { SCHEMA_FILE_NAME } from './recipe-schema-v2.js'

/**
 * A fixture's expected outcome, as recorded in `schemas/fixtures/manifest.json`.
 *
 * The manifest is generated from the C# reference implementation, never hand-written: a hash typed
 * by hand cannot fail in a visible way — it simply becomes the value every stack is asked to
 * reproduce, and the mistake looks like agreement.
 */
export interface FixtureExpectation {
  /** File name inside `schemas/fixtures/`. */
  file: string
  /** Whether the document satisfies the v2 contract. */
  expectedValid: boolean
  /** Distinct validation codes the document must produce, ordered. */
  expectedCodes: string[]
  /** Lowercase hex SHA-256 of the canonical form. */
  canonicalHash: string
}

/** The fixture manifest as a whole. */
export interface FixtureManifest {
  schema: string
  schemaVersion: number
  fixtures: FixtureExpectation[]
}

/**
 * Root of the `schemas/` directory inside the installed package.
 *
 * `__dirname` is `<package>/dist/cjs` after compilation, so the schemas sit two levels up.
 * Resolving from the module rather than from `process.cwd()` keeps it correct no matter where the
 * consumer runs its tests from.
 */
const SCHEMAS_DIR = join(__dirname, '..', '..', 'schemas')
const FIXTURES_DIR = join(SCHEMAS_DIR, 'fixtures')

/** The v2 JSON Schema document, verbatim. */
export function readSchema(): string {
  return readFileSync(join(SCHEMAS_DIR, SCHEMA_FILE_NAME), 'utf-8')
}

/** The parsed fixture manifest. */
export function readManifest(): FixtureManifest {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, 'manifest.json'), 'utf-8')) as FixtureManifest
}

/**
 * File names of every fixture in the corpus (manifest excluded), ordered by name so the three
 * stacks iterate in the same sequence.
 */
export function listFixtureNames(): string[] {
  return readdirSync(FIXTURES_DIR)
    .filter((name) => name.endsWith('.json') && name !== 'manifest.json')
    .sort()
}

/** Reads a fixture by file name, e.g. `01-linear-role-css.json`. */
export function readFixture(fileName: string): string {
  return readFileSync(join(FIXTURES_DIR, fileName), 'utf-8')
}
