namespace Facturatix.Contracts.Tickets;

/// <summary>
/// Canonical snake_case string constants for internal pipeline statuses.
/// These values are the single source of truth for database serialization and must
/// match the <c>InternalStatus</c> enum defined in <c>facturatix-api</c>.
/// <para>
/// Any divergence between these constants and the API's enum values will be caught
/// at build time by the contract tests in <c>Application.Tests</c>.
/// </para>
/// </summary>
public static class InternalStatusValues
{
    public const string Pending = "pending";
    public const string Processing = "processing";
    public const string ImageOptimizing = "image_optimizing";
    public const string ImageOptimized = "image_optimized";
    public const string ImageOptimizationFailed = "image_optimization_failed";
    public const string Extracting = "extracting";
    public const string Extracted = "extracted";
    public const string ExtractionFailed = "extraction_failed";
    public const string RecipeLookup = "recipe_lookup";
    public const string RecipeNotFound = "recipe_not_found";
    public const string RecipeFound = "recipe_found";
    public const string Invoicing = "invoicing";
    public const string InvoicingFailed = "invoicing_failed";
    public const string Invoiced = "invoiced";
}
