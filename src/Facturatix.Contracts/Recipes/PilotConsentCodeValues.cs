namespace Facturatix.Contracts.Recipes;

/// <summary>
/// Canonical codes for the consent under which a user is enrolled in a recipe's pilot audience,
/// persisted in <c>recipes.RecipePilotMembers.ConsentCode</c>.
/// <para>
/// A code, never the accepted wording: storing the sentence would freeze the language at write
/// time — the same rule that governs ticket rejection reasons. The Modeler renders the copy for
/// each code; the API validates enrolment requests against <see cref="All"/>.
/// </para>
/// </summary>
public static class PilotConsentCodeValues
{
    /// <summary>An employee of the operator, covered by the internal pilot policy (version 1).</summary>
    public const string InternalStaffV1 = "internal_staff_v1";

    /// <summary>A user who explicitly opted into piloting recipes (consent text version 1).</summary>
    public const string PilotOptInV1 = "pilot_optin_v1";

    /// <summary>Storage width of the column the codes are written to.</summary>
    public const int MaxLength = 40;

    /// <summary>Every code the API accepts.</summary>
    public static readonly IReadOnlyList<string> All = [InternalStaffV1, PilotOptInV1];
}
