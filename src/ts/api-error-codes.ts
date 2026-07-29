/**
 * Machine-readable error codes returned by facturatix-api in `ProblemDetails.extensions.code`.
 *
 * TypeScript mirror of `Facturatix.Contracts.Errors.ApiErrorCodes`. Clients branch on these values,
 * never on the HTTP status or the human message: a bare `409` cannot distinguish "this slug is
 * taken" from "this version is already published", and guessing between them is what created a
 * phantom v2 on every first publication from the Modeler.
 *
 * @module
 */

export const API_ERROR_CODES = {
  // ── Recipes ───────────────────────────────────────────────────────────────────────────────
  /** The recipe does not exist (by id or slug). */
  RECIPE_NOT_FOUND: 'recipe_not_found',
  /** Another recipe already owns this slug. Recoverable: fetch it and add a version. */
  RECIPE_SLUG_CONFLICT: 'recipe_slug_conflict',
  /** Another recipe already covers this (tax id, invoice url) pair. */
  RECIPE_IDENTITY_CONFLICT: 'recipe_identity_conflict',
  /** The requested version does not exist. */
  RECIPE_VERSION_NOT_FOUND: 'recipe_version_not_found',
  /**
   * Publish was attempted on a version that is not a draft. Not recoverable by retrying with a new
   * version: the client state is inconsistent and must be surfaced to the operator.
   */
  VERSION_NOT_DRAFT: 'version_not_draft',
  /** Deprecation was attempted on a version that is not published. */
  VERSION_NOT_PUBLISHED: 'version_not_published',
  /** Archival was attempted on a version that is not deprecated. */
  VERSION_NOT_DEPRECATED: 'version_not_deprecated',
  /** Rollback was attempted from a draft, which is already editable. */
  VERSION_IS_DRAFT: 'version_is_draft',
  /** The recipe is already active. */
  RECIPE_ALREADY_ACTIVE: 'recipe_already_active',
  /** The recipe is already inactive. */
  RECIPE_ALREADY_INACTIVE: 'recipe_already_inactive',
  /** The payload failed validation; `extensions.errors` carries the detail. */
  VALIDATION_FAILED: 'validation_failed',

  // ── Tickets ───────────────────────────────────────────────────────────────────────────────
  TICKET_NOT_FOUND: 'ticket_not_found',
  INVALID_IMAGE_FORMAT: 'invalid_image_format',
  IMAGE_TOO_LARGE: 'image_too_large',
  TICKET_IMAGE_NOT_FOUND: 'ticket_image_not_found',
  /** The caller does not own the requested resource. */
  NOT_OWNER: 'not_owner',
  TICKET_NOT_DELETABLE: 'ticket_not_deletable',
  /** The account reached its plan limit for the current month. */
  QUOTA_EXCEEDED: 'quota_exceeded',
  STEP_SCREENSHOT_NOT_FOUND: 'step_screenshot_not_found',
  CONFIRMATION_NOT_FOUND: 'confirmation_not_found',
  TICKET_NOT_UNDER_REVIEW: 'ticket_not_under_review',
  TICKET_ALREADY_INVOICED: 'ticket_already_invoiced',

  // ── Users ─────────────────────────────────────────────────────────────────────────────────
  USER_NOT_FOUND: 'user_not_found',
  INVALID_NAME: 'invalid_name',
  PHOTO_NOT_FOUND: 'photo_not_found',

  // ── Releases ──────────────────────────────────────────────────────────────────────────────
  INVALID_APP_NAME: 'invalid_app_name',
  INVALID_PLATFORM: 'invalid_platform',
  RELEASE_VERSION_EXISTS: 'release_version_exists',
  RELEASE_NOT_FOUND: 'release_not_found',
  NO_UPDATE_AVAILABLE: 'no_update_available',

  // ── Idempotency ───────────────────────────────────────────────────────────────────────────
  IDEMPOTENCY_KEY_REUSE: 'idempotency_key_reuse',
  IDEMPOTENCY_IN_PROGRESS: 'idempotency_in_progress',
  IDEMPOTENCY_KEY_MISSING: 'idempotency_key_missing',
  IDEMPOTENCY_KEY_INVALID: 'idempotency_key_invalid',
  IDEMPOTENCY_REPLAY_FAILED: 'idempotency_replay_failed',

  // ── Transport-level ───────────────────────────────────────────────────────────────────────
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  INTERNAL_ERROR: 'internal_error'
} as const

/** Every code in the catalog. Consumers use it to reject unknown codes explicitly. */
export const ALL_API_ERROR_CODES: readonly string[] = Object.values(API_ERROR_CODES)

/**
 * Detail markers that accompany `validation_failed` for recipe payloads, so the Modeler can tell a
 * transport corruption from a contract violation.
 */
export const VALIDATION_DETAILS = {
  /** The client hash and the server hash of the canonical payload differ. */
  HASH_MISMATCH: 'hash_mismatch',
  /** The body's schema version disagrees with the one inside the payload. */
  SCHEMA_VERSION_MISMATCH: 'schema_version_mismatch',
  /** The payload failed the v2 contract. */
  SCHEMA_INVALID: 'schema_invalid'
} as const

/** Shape of an RFC 7807 response as facturatix-api emits it. */
export interface ApiProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  /** Machine-readable code from {@link API_ERROR_CODES}. Always present on API errors. */
  code?: string
  /** Per-field or per-rule detail; present on `validation_failed`. */
  errors?: string[]
}
