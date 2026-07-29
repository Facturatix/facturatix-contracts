using System.Collections.Generic;

namespace Facturatix.Contracts.Errors;

/// <summary>
/// Machine-readable error codes returned by facturatix-api in
/// <c>ProblemDetails.extensions.code</c>.
/// <para>
/// Clients branch on these values, never on the HTTP status or the human message. The Modeler is
/// the reason this catalog exists: a bare <c>409</c> cannot distinguish "this slug is taken" from
/// "this version is already published", and guessing between them created a phantom v2 on every
/// first publication.
/// </para>
/// <para>
/// The values are part of the public contract. Adding one is a minor change; renaming or removing
/// one is a breaking change and requires a major version of this package.
/// </para>
/// </summary>
public static class ApiErrorCodes
{
    // ── Recipes ─────────────────────────────────────────────────────────────────────────────

    /// <summary>The recipe does not exist (by id or slug).</summary>
    public const string RecipeNotFound = "recipe_not_found";

    /// <summary>Another recipe already owns this slug. Recoverable: fetch it and add a version.</summary>
    public const string RecipeSlugConflict = "recipe_slug_conflict";

    /// <summary>Another recipe already covers this (tax id, invoice url) pair.</summary>
    public const string RecipeIdentityConflict = "recipe_identity_conflict";

    /// <summary>The requested version does not exist.</summary>
    public const string RecipeVersionNotFound = "recipe_version_not_found";

    /// <summary>
    /// Publish was attempted on a version that is not a draft. Not recoverable by retrying with a
    /// new version: the client state is inconsistent and must be surfaced to the operator.
    /// </summary>
    public const string VersionNotDraft = "version_not_draft";

    /// <summary>Deprecation was attempted on a version that is not published.</summary>
    public const string VersionNotPublished = "version_not_published";

    /// <summary>Archival was attempted on a version that is not deprecated.</summary>
    public const string VersionNotDeprecated = "version_not_deprecated";

    /// <summary>Rollback was attempted from a draft, which is already editable.</summary>
    public const string VersionIsDraft = "version_is_draft";

    /// <summary>The recipe is already active.</summary>
    public const string RecipeAlreadyActive = "recipe_already_active";

    /// <summary>The recipe is already inactive.</summary>
    public const string RecipeAlreadyInactive = "recipe_already_inactive";

    /// <summary>
    /// The payload failed validation. <c>extensions.errors</c> carries the detail; for recipe
    /// payloads those details are <see cref="Recipes.RecipeSchemaV2.ValidationCodes"/> values.
    /// </summary>
    public const string ValidationFailed = "validation_failed";

    // ── Tickets ─────────────────────────────────────────────────────────────────────────────

    /// <summary>The ticket does not exist.</summary>
    public const string TicketNotFound = "ticket_not_found";

    /// <summary>The uploaded file is not a supported image type.</summary>
    public const string InvalidImageFormat = "invalid_image_format";

    /// <summary>The uploaded file exceeds the size limit.</summary>
    public const string ImageTooLarge = "image_too_large";

    /// <summary>The ticket image is not in storage.</summary>
    public const string TicketImageNotFound = "ticket_image_not_found";

    /// <summary>The caller does not own the requested resource.</summary>
    public const string NotOwner = "not_owner";

    /// <summary>The ticket left the pending state and can no longer be deleted.</summary>
    public const string TicketNotDeletable = "ticket_not_deletable";

    /// <summary>The account reached its plan limit for the current month.</summary>
    public const string QuotaExceeded = "quota_exceeded";

    /// <summary>No screenshot exists for that step index.</summary>
    public const string StepScreenshotNotFound = "step_screenshot_not_found";

    /// <summary>The terminal confirmation capture is not available yet.</summary>
    public const string ConfirmationNotFound = "confirmation_not_found";

    /// <summary>An admin action requires the ticket to be flagged for review.</summary>
    public const string TicketNotUnderReview = "ticket_not_under_review";

    /// <summary>The ticket already has an execution log; requeuing risks a duplicate invoice.</summary>
    public const string TicketAlreadyInvoiced = "ticket_already_invoiced";

    // ── Users ───────────────────────────────────────────────────────────────────────────────

    /// <summary>The user does not exist.</summary>
    public const string UserNotFound = "user_not_found";

    /// <summary>The submitted name is outside the accepted length.</summary>
    public const string InvalidName = "invalid_name";

    /// <summary>The profile photo is not in storage.</summary>
    public const string PhotoNotFound = "photo_not_found";

    // ── Releases ────────────────────────────────────────────────────────────────────────────

    /// <summary>Unknown application name in the update feed.</summary>
    public const string InvalidAppName = "invalid_app_name";

    /// <summary>Unknown platform identifier in the update feed.</summary>
    public const string InvalidPlatform = "invalid_platform";

    /// <summary>That release version already exists for the app and platform.</summary>
    public const string ReleaseVersionExists = "release_version_exists";

    /// <summary>No release exists for the requested app and platform.</summary>
    public const string ReleaseNotFound = "release_not_found";

    /// <summary>The client already runs the latest version.</summary>
    public const string NoUpdateAvailable = "no_update_available";

    // ── Idempotency ─────────────────────────────────────────────────────────────────────────

    /// <summary>The key was already used with a different payload.</summary>
    public const string IdempotencyKeyReuse = "idempotency_key_reuse";

    /// <summary>Another request holding the same key is still running. Retry shortly.</summary>
    public const string IdempotencyInProgress = "idempotency_in_progress";

    /// <summary>The mutating request did not carry an <c>X-Idempotency-Key</c> header.</summary>
    public const string IdempotencyKeyMissing = "idempotency_key_missing";

    /// <summary>The <c>X-Idempotency-Key</c> header is not a UUID.</summary>
    public const string IdempotencyKeyInvalid = "idempotency_key_invalid";

    /// <summary>The cached response for that key could not be replayed.</summary>
    public const string IdempotencyReplayFailed = "idempotency_replay_failed";

    // ── Transport-level ─────────────────────────────────────────────────────────────────────

    /// <summary>Authentication is missing or the token is not valid.</summary>
    public const string Unauthorized = "unauthorized";

    /// <summary>Authenticated, but the role does not allow the operation.</summary>
    public const string Forbidden = "forbidden";

    /// <summary>An unexpected server-side failure. Never carries diagnostic detail.</summary>
    public const string InternalError = "internal_error";

    /// <summary>Every code in the catalog. Consumers use it to reject unknown codes explicitly.</summary>
    public static readonly IReadOnlyList<string> All = new[]
    {
        RecipeNotFound, RecipeSlugConflict, RecipeIdentityConflict, RecipeVersionNotFound,
        VersionNotDraft, VersionNotPublished, VersionNotDeprecated, VersionIsDraft,
        RecipeAlreadyActive, RecipeAlreadyInactive, ValidationFailed,
        TicketNotFound, InvalidImageFormat, ImageTooLarge, TicketImageNotFound, NotOwner,
        TicketNotDeletable, QuotaExceeded, StepScreenshotNotFound, ConfirmationNotFound,
        TicketNotUnderReview, TicketAlreadyInvoiced,
        UserNotFound, InvalidName, PhotoNotFound,
        InvalidAppName, InvalidPlatform, ReleaseVersionExists, ReleaseNotFound, NoUpdateAvailable,
        IdempotencyKeyReuse, IdempotencyInProgress, IdempotencyKeyMissing, IdempotencyKeyInvalid,
        IdempotencyReplayFailed,
        Unauthorized, Forbidden, InternalError
    };

    /// <summary>
    /// Detail markers that accompany <see cref="ValidationFailed"/> for recipe payloads, so the
    /// Modeler can tell a transport corruption from a contract violation.
    /// </summary>
    public static class ValidationDetails
    {
        /// <summary>The client hash and the server hash of the canonical payload differ.</summary>
        public const string HashMismatch = "hash_mismatch";

        /// <summary>The body's schema version disagrees with the one inside the payload.</summary>
        public const string SchemaVersionMismatch = "schema_version_mismatch";

        /// <summary>The payload failed the v2 contract.</summary>
        public const string SchemaInvalid = "schema_invalid";
    }
}
