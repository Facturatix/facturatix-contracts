/**
 * JSON Canonicalization Scheme (RFC 8785) plus the SHA-256 fingerprint the platform uses to
 * identify a recipe payload.
 *
 * TypeScript half of a two-language agreement: `Facturatix.Contracts.Recipes.RecipeCanonicalJson`
 * is the C# half. The Modeler hashes a document before publishing it and the API recomputes the
 * hash on arrival; if the two implementations disagreed on a single byte, every publication would
 * be rejected as corrupted in transit. The shared fixture manifest asserts they do not.
 *
 * Two details carry that agreement:
 *
 * - `JSON.stringify` on a string escapes only what JSON requires, leaving accented characters
 *   literal. The C# side had to opt into the same behaviour explicitly (`UnsafeRelaxedJsonEscaping`),
 *   because .NET escapes non-ASCII by default — which would give every Spanish string a different
 *   hash in each stack.
 * - Numbers are only guaranteed equal for integers, which is why the v2 schema declares every
 *   numeric field as `integer`.
 *
 * @module
 */

import { createHash } from 'crypto'

/**
 * Rewrites a JSON document in canonical form: object keys sorted by UTF-16 code unit, no
 * insignificant whitespace, array order preserved.
 *
 * @param json - Any valid JSON document.
 * @returns The canonical serialization of the same document.
 * @throws SyntaxError when the input is not valid JSON.
 */
export function canonicalize(json: string): string {
  return canonicalizeValue(JSON.parse(json))
}

/**
 * Canonicalizes an in-memory value. Use when the document was built rather than received, which
 * saves a parse round trip in the Modeler's publish path.
 *
 * @param value - Any JSON-serializable value.
 * @returns The canonical serialization.
 */
export function canonicalizeValue(value: unknown): string {
  if (value === null || value === undefined) return 'null'

  const type = typeof value
  if (type === 'boolean') return value ? 'true' : 'false'
  if (type === 'number') return canonicalNumber(value as number)
  if (type === 'string') return JSON.stringify(value)

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeValue(item)).join(',')}]`
  }

  if (type === 'object') {
    const record = value as Record<string, unknown>
    // Default Array#sort compares UTF-16 code units, which is the ordering RFC 8785 mandates and
    // exactly what string.CompareOrdinal does on the C# side.
    const keys = Object.keys(record).sort()
    const members = keys.map((key) => `${JSON.stringify(key)}:${canonicalizeValue(record[key])}`)
    return `{${members.join(',')}}`
  }

  return JSON.stringify(value) ?? 'null'
}

/**
 * Canonicalizes the document and returns the lowercase hex SHA-256 of its UTF-8 bytes.
 *
 * @param json - Any valid JSON document.
 * @returns 64 lowercase hex characters.
 */
export function computeHash(json: string): string {
  return hashCanonical(canonicalize(json))
}

/**
 * Canonicalizes an in-memory value and hashes it.
 *
 * @param value - Any JSON-serializable value.
 * @returns 64 lowercase hex characters.
 */
export function computeValueHash(value: unknown): string {
  return hashCanonical(canonicalizeValue(value))
}

/**
 * Hashes an already-canonical string.
 *
 * @param canonicalJson - Output of {@link canonicalize}.
 * @returns 64 lowercase hex characters.
 */
export function hashCanonical(canonicalJson: string): string {
  return createHash('sha256').update(canonicalJson, 'utf8').digest('hex')
}

/**
 * Serializes a number the way both stacks agree on.
 *
 * Only integers are part of that agreement; the schema restricts every numeric field to `integer`
 * for exactly this reason. Non-integers still round-trip, they simply carry no cross-stack
 * guarantee.
 */
function canonicalNumber(value: number): string {
  if (!Number.isFinite(value)) return 'null'
  if (Object.is(value, -0)) return '0'
  return String(value)
}
