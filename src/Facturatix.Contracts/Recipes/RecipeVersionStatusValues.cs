namespace Facturatix.Contracts.Recipes;

/// <summary>
/// Canonical string constants for invoice recipe version lifecycle statuses.
/// These values are the single source of truth for database serialization and must
/// match the lifecycle states defined in the <c>InvoiceRecipeVersion</c> domain entity
/// within <c>facturatix-api</c>.
/// <para>
/// Lifecycle: <c>Draft → Piloting → Published → Deprecated → Archived</c>. A pilot that is
/// abandoned returns to <see cref="Draft"/> — never to <see cref="Deprecated"/>, which the
/// Generator still executes on a requeue.
/// </para>
/// <para>
/// The Generator executes a <see cref="Published"/> version for everyone and a
/// <see cref="Piloting"/> version only for the users enrolled in that recipe's pilot audience. A
/// worker that predates the pilot channel filters on <c>published</c> alone and therefore never
/// sees a piloting row: the fifth state was chosen over a channel column precisely so that stale
/// code fails towards "not visible" rather than "executed for anyone".
/// </para>
/// <para>
/// Any divergence between these constants and the API's domain values will be caught
/// at build time by the contract tests in <c>Application.Tests</c>.
/// </para>
/// </summary>
public static class RecipeVersionStatusValues
{
    public const string Draft = "draft";
    public const string Piloting = "piloting";
    public const string Published = "published";
    public const string Deprecated = "deprecated";
    public const string Archived = "archived";

    /// <summary>Every lifecycle status, in transition order.</summary>
    public static readonly IReadOnlyList<string> All = [Draft, Piloting, Published, Deprecated, Archived];
}
