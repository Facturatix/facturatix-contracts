using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;

namespace Facturatix.Contracts.Recipes;

/// <summary>
/// Access to the contract artefacts shipped inside this package: the JSON Schema, the fixture
/// corpus and the fixture manifest.
/// </summary>
/// <remarks>
/// They are read from embedded resources rather than from disk on purpose. A contract gate that
/// loads fixtures from a path can pass by finding none — the exact failure that turns a gate into
/// decoration. Reading from the assembly makes "no fixtures" impossible: the file is either in the
/// package or the package does not build.
/// </remarks>
public static class RecipeContractResources
{
    private const string SchemaResource = "schemas/" + RecipeSchemaV2.SchemaFileName;
    private const string ManifestResource = "schemas/fixtures/manifest.json";
    private const string FixturePrefix = "schemas/fixtures/";

    private static readonly Assembly Assembly = typeof(RecipeContractResources).Assembly;

    /// <summary>The v2 JSON Schema document, verbatim.</summary>
    public static string ReadSchema() => ReadResource(SchemaResource);

    /// <summary>The fixture manifest listing each fixture's expected verdict and canonical hash.</summary>
    public static string ReadManifest() => ReadResource(ManifestResource);

    /// <summary>
    /// File names of every fixture in the corpus (manifest excluded), ordered by name so the three
    /// stacks iterate in the same sequence.
    /// </summary>
    public static IReadOnlyList<string> FixtureNames =>
        Assembly.GetManifestResourceNames()
            .Where(name => name.StartsWith(FixturePrefix, StringComparison.Ordinal))
            .Select(name => name.Substring(FixturePrefix.Length))
            .Where(name => name != "manifest.json")
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToList();

    /// <summary>Reads a fixture by file name, e.g. <c>01-linear-role-css.json</c>.</summary>
    /// <exception cref="InvalidOperationException">No fixture with that name is packaged.</exception>
    public static string ReadFixture(string fileName) => ReadResource(FixturePrefix + fileName);

    private static string ReadResource(string logicalName)
    {
        using var stream = Assembly.GetManifestResourceStream(logicalName)
            ?? throw new InvalidOperationException(
                $"'{logicalName}' is not embedded in {Assembly.GetName().Name}. " +
                "The contract artefacts must ship with the package.");

        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
