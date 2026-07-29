using System.Collections.Generic;
using System.Linq;

namespace Facturatix.Contracts.Recipes;

/// <summary>
/// A single reason a recipe document was rejected.
/// </summary>
/// <remarks>
/// <paramref name="Code"/> is the machine-readable identifier (see
/// <see cref="RecipeSchemaV2.ValidationCodes"/>); <paramref name="Path"/> is a JSON-pointer-like
/// location such as <c>actions[3].locator</c>; <paramref name="Message"/> is for humans only and
/// must never be parsed.
/// </remarks>
public sealed class RecipeValidationIssue
{
    public RecipeValidationIssue(string code, string path, string message)
    {
        Code = code;
        Path = path;
        Message = message;
    }

    /// <summary>Stable machine-readable identifier of the rule that failed.</summary>
    public string Code { get; }

    /// <summary>Location inside the document, e.g. <c>actions[3].locator</c>.</summary>
    public string Path { get; }

    /// <summary>Human-readable explanation. Not part of the contract.</summary>
    public string Message { get; }

    /// <summary>Renders the issue as <c>path: message</c> for display in the Modeler.</summary>
    public override string ToString() =>
        string.IsNullOrEmpty(Path) ? Message : Path + ": " + Message;
}

/// <summary>
/// Verdict of validating a recipe document against the v2 contract.
/// <para>
/// The result is fail-closed by construction: any issue makes <see cref="IsValid"/> false.
/// There is no severity axis — a document is either executable or it is not.
/// </para>
/// </summary>
public sealed class RecipeValidationResult
{
    private static readonly RecipeValidationIssue[] NoIssues = new RecipeValidationIssue[0];

    private RecipeValidationResult(IReadOnlyList<RecipeValidationIssue> issues)
    {
        Issues = issues;
    }

    /// <summary>A document that satisfied every structural and semantic rule.</summary>
    public static RecipeValidationResult Valid { get; } = new RecipeValidationResult(NoIssues);

    /// <summary>Builds a failed verdict from the collected issues.</summary>
    public static RecipeValidationResult Invalid(IReadOnlyList<RecipeValidationIssue> issues) =>
        issues == null || issues.Count == 0 ? Valid : new RecipeValidationResult(issues);

    /// <summary>True when the document can be published and executed.</summary>
    public bool IsValid => Issues.Count == 0;

    /// <summary>Every rule that failed, in document order.</summary>
    public IReadOnlyList<RecipeValidationIssue> Issues { get; }

    /// <summary>Distinct issue codes, ordered, for assertions and telemetry.</summary>
    public IReadOnlyList<string> Codes =>
        Issues.Select(i => i.Code).Distinct().OrderBy(c => c, System.StringComparer.Ordinal).ToList();

    /// <summary>Issue descriptions for display; empty when the document is valid.</summary>
    public IReadOnlyList<string> Messages => Issues.Select(i => i.ToString()).ToList();
}
