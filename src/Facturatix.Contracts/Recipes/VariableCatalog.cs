using System;
using System.Collections.Generic;
using System.Linq;

namespace Facturatix.Contracts.Recipes;

/// <summary>
/// Where a recipe variable's value comes from, and what the platform does with it.
/// <para>
/// <c>variableSource</c> in the JSON Schema bounds the NAMESPACE and nothing else. Measured against
/// the reference validator, <c>user.fiscal.rfk</c> and <c>user.nombre</c> are both valid documents:
/// they publish, reach a worker, resolve to nothing, and fail the ticket with
/// <c>variable_missing</c> — for a typo that three validation layers looked at and accepted. The
/// parts of the source that are genuinely closed therefore belong in the contract next to the
/// namespaces, and this type is those parts.
/// </para>
/// <para>
/// The two halves are closed differently. <see cref="UserFields"/> is a closed SET: its leaves are
/// columns the API owns, so a source outside the set cannot resolve.
/// <see cref="TicketValueKinds"/> closes the VOCABULARY and not the membership: a recipe may ask
/// the model for any field a portal needs, but only these leaf names carry a normalizer. That
/// distinction is load-bearing — the leaf of <c>ticket.extracted.&lt;leaf&gt;</c> is both the JSON
/// key the vision model is asked to return and the selector of the normalizer applied to the
/// answer, so <c>total</c> becomes <c>1234.50</c> while <c>total_venta</c> is passed through as
/// <c>$ 1,234.50</c>.
/// </para>
/// <para>
/// This type is a MIRROR of <c>schemas/variable-catalog.v1.json</c>, which ships in the same
/// package; the TypeScript twin mirrors the same file. A consumer proving it covers every entry
/// reads the artefact through <see cref="RecipeContractResources.ReadVariableCatalog"/> rather than
/// trusting this list, which is what makes such a test a gate instead of a tautology.
/// </para>
/// </summary>
public static class VariableCatalog
{
    /// <summary>File name of the artefact this type mirrors.</summary>
    public const string FileName = "variable-catalog.v1.json";

    /// <summary>Version of the catalogue mirrored here.</summary>
    public const int Version = 1;

    /// <summary>Whether a recipe may bind a stored user value.</summary>
    /// <remarks>
    /// <c>stored_only</c> is not an oversight to be fixed by adding the field to the resolver. A
    /// variable is only ever rendered into the <c>value</c> of a <c>fill</c>/<c>select</c> or the
    /// <c>url</c> of a <c>goto</c>, and the boolean fiscal flags have no text form a Mexican portal
    /// accepts; <c>check</c> and <c>uncheck</c> take no value, and every condition type reads the
    /// page rather than a variable. Making them bindable needs a contract addition — a condition
    /// that reads a variable — not a catalogue edit. They are listed so an author auditing their
    /// coverage can see that they exist and why they are not on offer.
    /// </remarks>
    public static class Support
    {
        public const string Bindable = "bindable";
        public const string StoredOnly = "stored_only";
    }

    /// <summary>Whether the platform can promise the field has a value.</summary>
    /// <remarks>
    /// <c>always</c> — every write path validates it as non-empty. <c>optional</c> — the platform
    /// accepts a profile without it, which covers the nullable columns and also <c>user.email</c>
    /// and <c>user.name</c>: both are <c>NOT NULL</c> and both arrive through a helper whose
    /// documented contract is "a value that fits, possibly empty".
    /// </remarks>
    public static class Availability
    {
        public const string Always = "always";
        public const string Optional = "optional";
    }

    /// <summary>What the platform does to a value the vision model read off the ticket.</summary>
    public static class ValueKinds
    {
        public const string Text = "text";
        public const string TaxId = "tax_id";
        public const string PostalCode = "postal_code";
        public const string Amount = "amount";
        public const string Date = "date";
    }

    /// <summary>
    /// Every value the platform stores about the account holder, in the order the artefact lists
    /// them. The order is part of the mirror: parity is compared positionally.
    /// </summary>
    public static readonly IReadOnlyList<UserFieldDefinition> UserFields = new[]
    {
        new UserFieldDefinition("user.email", Support.Bindable, Availability.Optional),
        new UserFieldDefinition("user.name", Support.Bindable, Availability.Optional),
        new UserFieldDefinition("user.fiscal.rfc", Support.Bindable, Availability.Always),
        new UserFieldDefinition("user.fiscal.legal_name", Support.Bindable, Availability.Always),
        new UserFieldDefinition("user.fiscal.tax_regime", Support.Bindable, Availability.Always),
        new UserFieldDefinition("user.fiscal.email", Support.Bindable, Availability.Optional),
        new UserFieldDefinition("user.fiscal.postal_code", Support.Bindable, Availability.Always),
        new UserFieldDefinition("user.fiscal.street", Support.Bindable, Availability.Optional),
        new UserFieldDefinition(
            "user.fiscal.exterior_number", Support.Bindable, Availability.Optional),
        new UserFieldDefinition(
            "user.fiscal.interior_number", Support.Bindable, Availability.Optional),
        new UserFieldDefinition("user.fiscal.neighborhood", Support.Bindable, Availability.Optional),
        new UserFieldDefinition("user.fiscal.municipality", Support.Bindable, Availability.Optional),
        new UserFieldDefinition("user.fiscal.state", Support.Bindable, Availability.Optional),
        new UserFieldDefinition("user.fiscal.reference", Support.Bindable, Availability.Optional),
        new UserFieldDefinition("user.fiscal.country", Support.Bindable, Availability.Always),
        new UserFieldDefinition("user.fiscal.is_foreign", Support.StoredOnly, Availability.Always),
        new UserFieldDefinition(
            "user.fiscal.is_politically_exposed", Support.StoredOnly, Availability.Always),
        new UserFieldDefinition(
            "user.fiscal.declares_ieps", Support.StoredOnly, Availability.Always),
    };

    /// <summary>
    /// Leaf names that carry a normalizer, in artefact order. A leaf outside these is normalized as
    /// <see cref="TicketDefaultValueKind"/>.
    /// </summary>
    public static readonly IReadOnlyList<TicketValueKindDefinition> TicketValueKinds = new[]
    {
        new TicketValueKindDefinition(ValueKinds.TaxId, new[] { "rfc", "tax_id", "taxid" }),
        new TicketValueKindDefinition(
            ValueKinds.PostalCode, new[] { "postal_code", "codigo_postal", "cp", "zip" }),
        new TicketValueKindDefinition(
            ValueKinds.Amount,
            new[] { "total", "amount", "importe", "monto", "subtotal", "iva", "impuesto" }),
        new TicketValueKindDefinition(
            ValueKinds.Date,
            new[] { "date", "fecha", "issue_date", "fecha_emision", "ticket_date" }),
    };

    /// <summary>
    /// The normalizer applied when a leaf matches no catalogued name: whitespace is collapsed and
    /// nothing else, because that is the only transformation that is safe on a value whose meaning
    /// is unknown.
    /// </summary>
    public const string TicketDefaultValueKind = ValueKinds.Text;

    private static readonly IReadOnlyDictionary<string, UserFieldDefinition> UserFieldBySource =
        UserFields.ToDictionary(field => field.Source, StringComparer.Ordinal);

    private static readonly IReadOnlyDictionary<string, string> TicketKindByLeaf =
        TicketValueKinds
            .SelectMany(entry => entry.Leaves.Select(leaf => (Leaf: leaf, entry.Kind)))
            .ToDictionary(pair => pair.Leaf, pair => pair.Kind, StringComparer.Ordinal);

    /// <summary>The sources a recipe variable may declare, in catalogue order.</summary>
    public static IReadOnlyList<string> BindableUserFieldSources { get; } =
        UserFields
            .Where(field => field.Support == Support.Bindable)
            .Select(field => field.Source)
            .ToList();

    /// <summary>
    /// The definition behind a user source, or <see langword="null"/> when the platform stores no
    /// such value. O(1).
    /// </summary>
    /// <param name="source">A variable's declared source.</param>
    public static UserFieldDefinition? FindUserField(string? source) =>
        source is not null && UserFieldBySource.TryGetValue(source, out var field) ? field : null;

    /// <summary>
    /// Whether a source names a user value a recipe may bind. Narrower than
    /// <see cref="RecipeSchemaV2.VariableSources"/>'s prefixes on purpose: the prefix answers
    /// "could this be a user field", this answers "is it one the executor will resolve". O(1).
    /// </summary>
    /// <param name="source">A variable's declared source.</param>
    public static bool IsBindableUserField(string? source) =>
        FindUserField(source)?.Support == Support.Bindable;

    /// <summary>
    /// What the platform will do to the value read for a ticket source. O(1).
    /// </summary>
    /// <param name="source">A <c>ticket.extracted.*</c> source, or its bare leaf.</param>
    /// <returns>
    /// The normalizer that will be applied, or <see cref="TicketDefaultValueKind"/> when the leaf
    /// carries none.
    /// </returns>
    public static string TicketValueKindOf(string? source)
    {
        if (source is null)
        {
            return TicketDefaultValueKind;
        }

        return TicketKindByLeaf.TryGetValue(LeafOfSource(source), out var kind)
            ? kind
            : TicketDefaultValueKind;
    }

    /// <summary>
    /// The last dot-separated segment of a canonical source.
    /// </summary>
    /// <param name="source">A variable's declared source, e.g. <c>ticket.extracted.total</c>.</param>
    /// <returns>The leaf, or the whole string when it carries no dot.</returns>
    public static string LeafOfSource(string source)
    {
        ArgumentNullException.ThrowIfNull(source);

        var lastDot = source.LastIndexOf('.');
        return lastDot >= 0 && lastDot < source.Length - 1 ? source[(lastDot + 1)..] : source;
    }
}

/// <summary>One value the platform stores about the account holder.</summary>
/// <param name="Source">The canonical <c>source</c> a recipe variable declares.</param>
/// <param name="Support">One of <see cref="VariableCatalog.Support"/>.</param>
/// <param name="Availability">One of <see cref="VariableCatalog.Availability"/>.</param>
public sealed record UserFieldDefinition(string Source, string Support, string Availability);

/// <summary>Leaf names that select one normalizer.</summary>
/// <param name="Kind">One of <see cref="VariableCatalog.ValueKinds"/>, never <c>text</c>.</param>
/// <param name="Leaves">Leaf names that map to <paramref name="Kind"/>, in artefact order.</param>
public sealed record TicketValueKindDefinition(string Kind, IReadOnlyList<string> Leaves);
