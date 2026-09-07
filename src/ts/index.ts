/**
 * `@facturatix/contracts` — the TypeScript half of the Facturatix platform contract.
 *
 * The C# package `Facturatix.Contracts` is the other half. Both ship from the same tag with the
 * same version number, and both carry the same `schemas/` directory, so "which contract are we on"
 * has one answer across .NET and Node.
 *
 * This entry point is deliberately expressed as `./schema.js` plus the canonicalizer rather than as
 * its own list of modules. Two hand-maintained lists drift — and the drift is silent in the
 * direction that matters, because the browser-safe entry is the one that loses an export while
 * every Node consumer keeps working. Composing them makes the relationship structural: the root is
 * `/schema` and the one thing `/schema` cannot carry, which is the RFC 8785 canonicalizer's
 * dependency on `node:crypto`.
 *
 * @module
 */

export * from './schema.js'
export * from './canonical-json.js'
