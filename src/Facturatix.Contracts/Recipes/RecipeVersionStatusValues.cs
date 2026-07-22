namespace Facturatix.Contracts.Recipes;

/// <summary>
/// Canonical string constants for invoice recipe version lifecycle statuses.
/// These values are the single source of truth for database serialization and must
/// match the lifecycle states defined in the <c>InvoiceRecipeVersion</c> domain entity
/// within <c>facturatix-api</c>.
/// <para>
/// Lifecycle: <c>Draft → Published → Deprecated → Archived</c>.
/// The Generator only loads versions with <see cref="Published"/> status for execution.
/// </para>
/// <para>
/// Any divergence between these constants and the API's domain values will be caught
/// at build time by the contract tests in <c>Application.Tests</c>.
/// </para>
/// </summary>
public static class RecipeVersionStatusValues
{
    public const string Draft = "draft";
    public const string Published = "published";
    public const string Deprecated = "deprecated";
    public const string Archived = "archived";
}
