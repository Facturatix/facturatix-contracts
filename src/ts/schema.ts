/**
 * The runtime-agnostic half of the contract: vocabulary, document types and the validator.
 *
 * Importing this instead of the package root keeps `node:crypto` out of the dependency graph, which
 * matters for any consumer that bundles for a browser — an Electron renderer, a web client. The
 * root entry additionally exports the RFC 8785 canonicalizer, and that one genuinely needs Node.
 *
 * **Every closed vocabulary belongs here, not in the root.** The root re-exports this module, so a
 * constant added here reaches both entry points; one added only to the root is invisible to browser
 * consumers, and the only way for them to reach it is the import that breaks them. That is not
 * hypothetical: 2.3.0 left `PILOT_CONSENT_CODE` and `PILOT_ABANDON_REASON` out of this module, the
 * Modeler's pilot screens imported the root to reach them, and the renderer died on `crypto` at
 * module evaluation — a blank window, with the app's own tests still green because they run in Node.
 *
 * @module
 */

export * from './recipe-schema-v2.js'
export * from './validator.js'
export * from './api-error-codes.js'
export * from './status-values.js'
export * from './pilot-values.js'
export * from './rejection-reasons.js'
