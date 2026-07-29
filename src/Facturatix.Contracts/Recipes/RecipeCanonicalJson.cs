using System;
using System.Collections.Generic;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;

namespace Facturatix.Contracts.Recipes;

/// <summary>
/// JSON Canonicalization Scheme (RFC 8785) plus the SHA-256 fingerprint the platform uses to
/// identify a recipe payload.
/// <para>
/// Three independent stacks hash the same document — the Modeler before publishing, the API when
/// persisting, the Generator when auditing an execution — and all three must agree bit for bit.
/// This type is the C# half of that agreement; <c>@facturatix/contracts</c> ships the TypeScript
/// half, and the shared fixtures assert that both produce the manifest hash.
/// </para>
/// </summary>
/// <remarks>
/// Two deliberate choices keep the two implementations equal:
/// <list type="bullet">
/// <item><description>
/// Strings are escaped with <see cref="JavaScriptEncoder.UnsafeRelaxedJsonEscaping"/>, matching
/// ECMAScript <c>JSON.stringify</c>. The default .NET encoder escapes non-ASCII characters as
/// <c>\uXXXX</c>, which would make every accented Spanish string hash differently in C# than in
/// TypeScript.
/// </description></item>
/// <item><description>
/// Numbers are emitted from their integer value. The v2 contract declares every numeric field as
/// <c>integer</c>, so this covers the whole contract surface. Non-integer numbers fall back to
/// round-trip formatting, which is outside the guaranteed-equal set and is why the schema does not
/// use them.
/// </description></item>
/// </list>
/// </remarks>
public static class RecipeCanonicalJson
{
    private static readonly JsonSerializerOptions StringEscapeOptions = new JsonSerializerOptions
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    /// <summary>
    /// Rewrites a JSON document in canonical form: object keys sorted by UTF-16 code unit,
    /// no insignificant whitespace, array order preserved.
    /// </summary>
    /// <param name="json">Any valid JSON document.</param>
    /// <returns>The canonical serialization of the same document.</returns>
    /// <exception cref="JsonException">The input is not valid JSON.</exception>
    /// <remarks>O(n log n) time in the number of keys (sorting per object), O(n) space.</remarks>
    public static string Canonicalize(string json)
    {
        if (json == null) throw new ArgumentNullException(nameof(json));

        using var document = JsonDocument.Parse(json);
        var builder = new StringBuilder(json.Length);
        WriteValue(document.RootElement, builder);
        return builder.ToString();
    }

    /// <summary>
    /// Canonicalizes the document and returns the lowercase hex SHA-256 of its UTF-8 bytes.
    /// </summary>
    /// <param name="json">Any valid JSON document.</param>
    /// <returns>64 lowercase hex characters.</returns>
    public static string ComputeHash(string json) => HashCanonical(Canonicalize(json));

    /// <summary>
    /// Hashes an already-canonical string. Use when the canonical form is needed separately and
    /// re-canonicalizing would be wasted work.
    /// </summary>
    /// <param name="canonicalJson">Output of <see cref="Canonicalize"/>.</param>
    /// <returns>64 lowercase hex characters.</returns>
    public static string HashCanonical(string canonicalJson)
    {
        if (canonicalJson == null) throw new ArgumentNullException(nameof(canonicalJson));

        using var sha256 = SHA256.Create();
        var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(canonicalJson));

        var hex = new StringBuilder(hash.Length * 2);
        foreach (var b in hash)
        {
            hex.Append(b.ToString("x2", CultureInfo.InvariantCulture));
        }

        return hex.ToString();
    }

    private static void WriteValue(JsonElement element, StringBuilder builder)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                WriteObject(element, builder);
                break;

            case JsonValueKind.Array:
                WriteArray(element, builder);
                break;

            case JsonValueKind.String:
                WriteString(element.GetString(), builder);
                break;

            case JsonValueKind.Number:
                WriteNumber(element, builder);
                break;

            case JsonValueKind.True:
                builder.Append("true");
                break;

            case JsonValueKind.False:
                builder.Append("false");
                break;

            default:
                builder.Append("null");
                break;
        }
    }

    private static void WriteObject(JsonElement element, StringBuilder builder)
    {
        // RFC 8785 orders members by the UTF-16 code units of their names, which is exactly what
        // string.CompareOrdinal compares and what Array.prototype.sort does by default in JS.
        var names = new List<string>();
        foreach (var property in element.EnumerateObject())
        {
            names.Add(property.Name);
        }

        names.Sort(string.CompareOrdinal);

        builder.Append('{');
        for (var i = 0; i < names.Count; i++)
        {
            if (i > 0) builder.Append(',');
            WriteString(names[i], builder);
            builder.Append(':');
            WriteValue(element.GetProperty(names[i]), builder);
        }

        builder.Append('}');
    }

    private static void WriteArray(JsonElement element, StringBuilder builder)
    {
        builder.Append('[');
        var first = true;
        foreach (var item in element.EnumerateArray())
        {
            if (!first) builder.Append(',');
            first = false;
            WriteValue(item, builder);
        }

        builder.Append(']');
    }

    private static void WriteString(string? value, StringBuilder builder)
    {
        builder.Append(JsonSerializer.Serialize(value ?? string.Empty, StringEscapeOptions));
    }

    private static void WriteNumber(JsonElement element, StringBuilder builder)
    {
        if (element.TryGetInt64(out var integer))
        {
            builder.Append(integer.ToString(CultureInfo.InvariantCulture));
            return;
        }

        // Outside the contract surface: the v2 schema declares every numeric field as `integer`.
        // Round-trip formatting keeps the value lossless, but cross-stack equality is only
        // guaranteed for integers, which is the reason the schema forbids fractions.
        builder.Append(element.GetDouble().ToString("R", CultureInfo.InvariantCulture));
    }
}
