/**
 * `@facturatix/contracts` — the TypeScript half of the Facturatix platform contract.
 *
 * The C# package `Facturatix.Contracts` is the other half. Both ship from the same tag with the
 * same version number, and both carry the same `schemas/` directory, so "which contract are we on"
 * has one answer across .NET and Node.
 *
 * @module
 */

export * from './recipe-schema-v2.js'
export * from './canonical-json.js'
export * from './validator.js'
export * from './api-error-codes.js'
export * from './status-values.js'
export * from './rejection-reasons.js'
