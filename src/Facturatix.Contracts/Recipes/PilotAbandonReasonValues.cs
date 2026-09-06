namespace Facturatix.Contracts.Recipes;

/// <summary>
/// Closed set of reasons for withdrawing a version from the pilot channel, sent by the Modeler in
/// <c>POST .../versions/{versionId}/pilot/abandon</c> and recorded in the recipe's audit trail.
/// <para>
/// A closed list rather than free text, so the trail can be filtered without parsing prose and the
/// wording lives in the client. Abandoning returns the version to <c>draft</c>; the reason says why
/// the trial stopped, not what happens next.
/// </para>
/// </summary>
public static class PilotAbandonReasonValues
{
    /// <summary>The pilot version failed against the portal and needs rework.</summary>
    public const string RecipeDefect = "recipe_defect";

    /// <summary>The merchant portal changed while the pilot was running.</summary>
    public const string PortalChanged = "portal_changed";

    /// <summary>A newer draft replaces this pilot before it was promoted.</summary>
    public const string Superseded = "superseded";

    /// <summary>The pilot audience is gone: every member expired or withdrew consent.</summary>
    public const string AudienceUnavailable = "audience_unavailable";

    /// <summary>The trial was called off for a reason outside the recipe itself.</summary>
    public const string Cancelled = "cancelled";

    /// <summary>Every reason the API accepts.</summary>
    public static readonly IReadOnlyList<string> All =
        [RecipeDefect, PortalChanged, Superseded, AudienceUnavailable, Cancelled];
}
