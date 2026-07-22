namespace Facturatix.Contracts.Tickets;

/// <summary>
/// Canonical string constants for user-facing ticket statuses.
/// These values are the single source of truth for database serialization and must
/// match the <c>UserStatus</c> enum defined in <c>facturatix-api</c>.
/// <para>
/// Any divergence between these constants and the API's enum values will be caught
/// at build time by the contract tests in <c>Application.Tests</c>.
/// </para>
/// </summary>
public static class UserStatusValues
{
    public const string Pending = "pending";
    public const string Processing = "processing";
    public const string Completed = "completed";
    public const string Failed = "failed";
}
