/**
 * Pilot channel vocabularies.
 *
 * TypeScript mirror of `Facturatix.Contracts.Recipes.PilotConsentCodeValues` and
 * `PilotAbandonReasonValues`. The Modeler renders the copy for each code and sends the code; the
 * API validates requests against these closed sets, so a value added on one side only is a request
 * the other side rejects.
 *
 * @module
 */

/** Consent under which a user is enrolled in a recipe's pilot audience. */
export const PILOT_CONSENT_CODE = {
  /** An employee of the operator, covered by the internal pilot policy (version 1). */
  INTERNAL_STAFF_V1: 'internal_staff_v1',
  /** A user who explicitly opted into piloting recipes (consent text version 1). */
  PILOT_OPTIN_V1: 'pilot_optin_v1'
} as const

/** A value of {@link PILOT_CONSENT_CODE}. */
export type PilotConsentCode = (typeof PILOT_CONSENT_CODE)[keyof typeof PILOT_CONSENT_CODE]

/** Every consent code the API accepts. */
export const ALL_PILOT_CONSENT_CODES: readonly PilotConsentCode[] =
  Object.values(PILOT_CONSENT_CODE)

/** Why a version was withdrawn from the pilot channel; the version returns to draft. */
export const PILOT_ABANDON_REASON = {
  /** The pilot version failed against the portal and needs rework. */
  RECIPE_DEFECT: 'recipe_defect',
  /** The merchant portal changed while the pilot was running. */
  PORTAL_CHANGED: 'portal_changed',
  /** A newer draft replaces this pilot before it was promoted. */
  SUPERSEDED: 'superseded',
  /** The pilot audience is gone: every member expired or withdrew consent. */
  AUDIENCE_UNAVAILABLE: 'audience_unavailable',
  /** The trial was called off for a reason outside the recipe itself. */
  CANCELLED: 'cancelled'
} as const

/** A value of {@link PILOT_ABANDON_REASON}. */
export type PilotAbandonReason = (typeof PILOT_ABANDON_REASON)[keyof typeof PILOT_ABANDON_REASON]

/** Every abandon reason the API accepts. */
export const ALL_PILOT_ABANDON_REASONS: readonly PilotAbandonReason[] =
  Object.values(PILOT_ABANDON_REASON)
