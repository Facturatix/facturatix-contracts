namespace Facturatix.Contracts.Tickets;

/// <summary>
/// Canonical snake_case values for the exposure channel a processing attempt ran through,
/// persisted in <c>tickets.TicketExecutionLogs.Channel</c>.
/// <para>
/// The Generator writes this column when it resolves the recipe version for an attempt, and the
/// API reads it back for the review screens and the promotion evidence. It is the half of the
/// answer to "did this CFDI come out of a version that was still under trial" that lives on the
/// attempt; the other half is the version's own lifecycle record.
/// </para>
/// <para>
/// <c>null</c> in the column is meaningful and is never backfilled: it marks attempts written
/// before the column existed, and attempts that never resolved a version at all.
/// </para>
/// </summary>
public static class ExecutionChannelValues
{
    /// <summary>The version every user of the recipe receives: the <c>published</c> version.</summary>
    public const string General = "general";

    /// <summary>
    /// A version under trial with a nominal, consenting audience: the <c>piloting</c> version.
    /// Only attempts for users enrolled in the recipe's pilot ever carry this value.
    /// </summary>
    public const string Pilot = "pilot";

    /// <summary>
    /// Every value the column may carry. The API reads this vocabulary as a closed set, so a value
    /// added here without the matching change there is persisted and never understood.
    /// </summary>
    public static readonly IReadOnlyList<string> All = [General, Pilot];
}
