using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Codes = Facturatix.Contracts.Recipes.RecipeSchemaV2.ValidationCodes;

namespace Facturatix.Contracts.Recipes;

/// <summary>
/// Reference implementation of the v2 recipe contract.
/// <para>
/// It enforces both halves of <c>schemas/recipe-execution.schema.v2.json</c>: the structural rules
/// a JSON Schema can express, and the graph and cross-reference rules it cannot (single root,
/// acyclicity, reachability, resolvable bindings). The API validates with it before publishing and
/// the Generator validates with it before executing, so a document can never be accepted by one and
/// rejected by the other.
/// </para>
/// <para>
/// The validator is fail-closed everywhere: anything it does not recognise — an unknown verb, an
/// unknown condition type, an unexpected property — is a rejection, never a value it silently drops.
/// That is what makes "the recipe was valid" a statement about execution and not about parsing.
/// </para>
/// </summary>
public static class RecipeSchemaV2Validator
{
    private static readonly Regex VariableNamePattern =
        new Regex("^[a-z][a-z0-9_]*$", RegexOptions.CultureInvariant);

    private static readonly Regex VariableSourcePattern = new Regex(
        @"^(user\.fiscal\.[a-z][a-z0-9_]*|user\.[a-z][a-z0-9_]*|ticket\.extracted\.[a-z][a-z0-9_]*)$",
        RegexOptions.CultureInvariant);

    /// <summary>Matches <c>{{ name }}</c> placeholders inside action values and urls.</summary>
    private static readonly Regex PlaceholderPattern =
        new Regex(@"\{\{\s*([A-Za-z0-9_.]+)\s*\}\}", RegexOptions.CultureInvariant);

    private static readonly HashSet<string> RootProperties =
        new HashSet<string>(RecipeSchemaV2.Properties.All, StringComparer.Ordinal);

    private static readonly HashSet<string> KnownActions =
        new HashSet<string>(RecipeSchemaV2.Actions.All, StringComparer.Ordinal);

    private static readonly HashSet<string> KnownStrategies =
        new HashSet<string>(RecipeSchemaV2.LocatorStrategies.All, StringComparer.Ordinal);

    private static readonly HashSet<string> KnownConditionTypes =
        new HashSet<string>(RecipeSchemaV2.ConditionTypes.All, StringComparer.Ordinal);

    private static readonly HashSet<string> KnownAssertionTypes =
        new HashSet<string>(RecipeSchemaV2.AssertionTypes.All, StringComparer.Ordinal);

    private static readonly HashSet<string> KnownDeliveryModes =
        new HashSet<string>(RecipeSchemaV2.DeliveryModes.All, StringComparer.Ordinal);

    private static readonly HashSet<string> KnownCompletionModes =
        new HashSet<string>(RecipeSchemaV2.CompletionModes.Values, StringComparer.Ordinal);

    private static readonly HashSet<string> KnownBranches =
        new HashSet<string>(RecipeSchemaV2.EdgeBranches.All, StringComparer.Ordinal);

    private static readonly string[] CommonActionProperties =
    {
        "id", "action", "description", "optional", "timeout_ms",
        "continue_on_error", "retry_count", "retry_delay_ms", "condition"
    };

    /// <summary>
    /// Validates a recipe document against the v2 contract.
    /// </summary>
    /// <param name="json">Raw contents of <c>InvoiceRecipeVersions.Steps</c>.</param>
    /// <returns>A verdict listing every rule that failed, in document order.</returns>
    /// <remarks>
    /// O(a + e) time where a = actions and e = edges: every check is a single pass or a
    /// hash-set lookup, and the graph walk visits each node and edge once.
    /// </remarks>
    public static RecipeValidationResult Validate(string json)
    {
        var issues = new List<RecipeValidationIssue>();

        if (string.IsNullOrWhiteSpace(json))
        {
            issues.Add(new RecipeValidationIssue(Codes.InvalidJson, "", "The recipe document is empty."));
            return RecipeValidationResult.Invalid(issues);
        }

        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(json);
        }
        catch (JsonException ex)
        {
            issues.Add(new RecipeValidationIssue(Codes.InvalidJson, "", ex.Message));
            return RecipeValidationResult.Invalid(issues);
        }

        using (document)
        {
            var root = document.RootElement;

            if (root.ValueKind != JsonValueKind.Object)
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.RootNotObject, "",
                    "The recipe document must be a JSON object, but was " + root.ValueKind + "."));
                return RecipeValidationResult.Invalid(issues);
            }

            RejectUnknownProperties(root, RootProperties, "", issues);
            ValidateSchemaVersion(root, issues);

            var variables = ValidateVariables(root, issues);
            var actions = ValidateActions(root, variables, issues);

            ValidateEdgesAndGraph(root, actions, issues);
            ValidateCompletion(root, variables, issues);
        }

        return RecipeValidationResult.Invalid(issues);
    }

    // ── schema_version ──────────────────────────────────────────────────────────────────────

    private static void ValidateSchemaVersion(JsonElement root, List<RecipeValidationIssue> issues)
    {
        if (!root.TryGetProperty(RecipeSchemaV2.Properties.SchemaVersion, out var version))
        {
            issues.Add(new RecipeValidationIssue(
                Codes.SchemaVersionMissing, RecipeSchemaV2.Properties.SchemaVersion,
                "The document does not declare schema_version."));
            return;
        }

        if (version.ValueKind != JsonValueKind.Number ||
            !version.TryGetInt32(out var value) ||
            value != RecipeSchemaV2.Version)
        {
            issues.Add(new RecipeValidationIssue(
                Codes.SchemaVersionUnsupported, RecipeSchemaV2.Properties.SchemaVersion,
                "Only schema_version " + RecipeSchemaV2.Version + " is supported by this contract."));
        }
    }

    // ── variables ───────────────────────────────────────────────────────────────────────────

    /// <summary>Declared variable names and the sources they resolve from.</summary>
    private sealed class VariableCatalog
    {
        public HashSet<string> Names { get; } = new HashSet<string>(StringComparer.Ordinal);
        public HashSet<string> Sources { get; } = new HashSet<string>(StringComparer.Ordinal);
    }

    private static VariableCatalog ValidateVariables(JsonElement root, List<RecipeValidationIssue> issues)
    {
        var catalog = new VariableCatalog();

        if (!root.TryGetProperty(RecipeSchemaV2.Properties.Variables, out var variables))
        {
            return catalog;
        }

        if (variables.ValueKind != JsonValueKind.Array)
        {
            issues.Add(new RecipeValidationIssue(
                Codes.VariableInvalid, RecipeSchemaV2.Properties.Variables,
                "variables must be an array."));
            return catalog;
        }

        var index = 0;
        foreach (var variable in variables.EnumerateArray())
        {
            var path = "variables[" + index.ToString(CultureInfo.InvariantCulture) + "]";
            index++;

            if (variable.ValueKind != JsonValueKind.Object)
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.VariableInvalid, path, "Each variable must be an object."));
                continue;
            }

            RejectUnknownProperties(
                variable,
                new HashSet<string>(new[] { "name", "source", "required", "pattern", "description" }, StringComparer.Ordinal),
                path,
                issues);

            var name = ReadString(variable, "name");
            if (name == null || !VariableNamePattern.IsMatch(name))
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.VariableInvalid, path + ".name",
                    "A variable name must match ^[a-z][a-z0-9_]*$."));
            }
            else if (!catalog.Names.Add(name))
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.VariableNameDuplicate, path + ".name",
                    "Variable '" + name + "' is declared more than once."));
            }

            var source = ReadString(variable, "source");
            if (source == null || !VariableSourcePattern.IsMatch(source))
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.VariableSourceUnknown, path + ".source",
                    "A variable source must be under user.*, user.fiscal.* or ticket.extracted.*."));
            }
            else
            {
                catalog.Sources.Add(source);
            }

            if (variable.TryGetProperty("required", out var required) &&
                required.ValueKind != JsonValueKind.True &&
                required.ValueKind != JsonValueKind.False)
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.VariableInvalid, path + ".required", "required must be a boolean."));
            }

            if (variable.TryGetProperty("pattern", out var pattern) &&
                (pattern.ValueKind != JsonValueKind.String || pattern.GetString()!.Length == 0))
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.VariableInvalid, path + ".pattern", "pattern must be a non-empty string."));
            }
        }

        return catalog;
    }

    // ── actions ─────────────────────────────────────────────────────────────────────────────

    /// <summary>An action as the graph checks need to see it.</summary>
    private sealed class ActionNode
    {
        public ActionNode(string id, bool isConditional, bool isOptional)
        {
            Id = id;
            IsConditional = isConditional;
            IsOptional = isOptional;
        }

        public string Id { get; }
        public bool IsConditional { get; }
        public bool IsOptional { get; }
    }

    private static List<ActionNode> ValidateActions(
        JsonElement root, VariableCatalog variables, List<RecipeValidationIssue> issues)
    {
        var nodes = new List<ActionNode>();

        if (!root.TryGetProperty(RecipeSchemaV2.Properties.Actions, out var actions))
        {
            issues.Add(new RecipeValidationIssue(
                Codes.ActionsMissing, RecipeSchemaV2.Properties.Actions,
                "The document does not declare an actions array."));
            return nodes;
        }

        if (actions.ValueKind != JsonValueKind.Array)
        {
            issues.Add(new RecipeValidationIssue(
                Codes.ActionsMissing, RecipeSchemaV2.Properties.Actions, "actions must be an array."));
            return nodes;
        }

        if (actions.GetArrayLength() == 0)
        {
            issues.Add(new RecipeValidationIssue(
                Codes.ActionsEmpty, RecipeSchemaV2.Properties.Actions,
                "A recipe needs at least one action."));
            return nodes;
        }

        var seenIds = new HashSet<string>(StringComparer.Ordinal);
        var index = 0;

        foreach (var action in actions.EnumerateArray())
        {
            var path = "actions[" + index.ToString(CultureInfo.InvariantCulture) + "]";
            index++;

            if (action.ValueKind != JsonValueKind.Object)
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.ActionFieldInvalid, path, "Each action must be an object."));
                continue;
            }

            var id = ReadString(action, "id");
            if (string.IsNullOrEmpty(id))
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.ActionIdMissing, path + ".id",
                    "Every action needs a non-empty id; edges address actions by it."));
            }
            else if (!seenIds.Add(id!))
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.ActionIdDuplicate, path + ".id",
                    "Action id '" + id + "' is used more than once."));
            }

            // The node is registered before the verb is checked so that an unrecognised verb
            // reports only itself. Skipping registration would make every edge touching the action
            // look dangling, burying the one issue the author has to fix under derived noise.
            var isConditional = ValidateCondition(action, path, issues);
            var isOptional = action.TryGetProperty("optional", out var optional) &&
                             optional.ValueKind == JsonValueKind.True;

            if (!string.IsNullOrEmpty(id))
            {
                nodes.Add(new ActionNode(id!, isConditional, isOptional));
            }

            var verb = ReadString(action, "action");
            if (verb == null || !KnownActions.Contains(verb))
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.ActionTypeUnknown, path + ".action",
                    "'" + (verb ?? "<missing>") + "' is not in the v2 action allowlist (" +
                    string.Join(", ", RecipeSchemaV2.Actions.All) + ")."));
                continue;
            }

            var allowed = new HashSet<string>(CommonActionProperties, StringComparer.Ordinal);
            foreach (var extra in VerbProperties(verb))
            {
                allowed.Add(extra);
            }

            RejectUnknownProperties(action, allowed, path, issues);
            ValidateCommonActionFields(action, path, issues);
            ValidateVerbFields(action, verb, path, variables, issues);
        }

        return nodes;
    }

    private static IEnumerable<string> VerbProperties(string verb)
    {
        switch (verb)
        {
            case RecipeSchemaV2.Actions.Goto:
                return new[] { "url" };
            case RecipeSchemaV2.Actions.Fill:
            case RecipeSchemaV2.Actions.Select:
                return new[] { "locator", "value" };
            case RecipeSchemaV2.Actions.Press:
                return new[] { "locator", "key" };
            case RecipeSchemaV2.Actions.Wait:
                return new[] { "duration_ms" };
            default:
                return new[] { "locator" };
        }
    }

    private static void ValidateCommonActionFields(
        JsonElement action, string path, List<RecipeValidationIssue> issues)
    {
        RequireIntegerIfPresent(action, "timeout_ms", path, 100, 300000, issues);
        RequireIntegerIfPresent(action, "retry_count", path, 0, 5, issues);
        RequireIntegerIfPresent(action, "retry_delay_ms", path, 0, 60000, issues);

        if (action.TryGetProperty("continue_on_error", out var continueOnError) &&
            continueOnError.ValueKind != JsonValueKind.True &&
            continueOnError.ValueKind != JsonValueKind.False)
        {
            issues.Add(new RecipeValidationIssue(
                Codes.ActionFieldInvalid, path + ".continue_on_error",
                "continue_on_error must be a boolean."));
        }

        if (action.TryGetProperty("optional", out var optional) &&
            optional.ValueKind != JsonValueKind.True &&
            optional.ValueKind != JsonValueKind.False)
        {
            issues.Add(new RecipeValidationIssue(
                Codes.ActionFieldInvalid, path + ".optional", "optional must be a boolean."));
        }
    }

    private static void ValidateVerbFields(
        JsonElement action,
        string verb,
        string path,
        VariableCatalog variables,
        List<RecipeValidationIssue> issues)
    {
        switch (verb)
        {
            case RecipeSchemaV2.Actions.Goto:
                RequireTemplateString(action, "url", path, variables, issues);
                break;

            case RecipeSchemaV2.Actions.Fill:
            case RecipeSchemaV2.Actions.Select:
                RequireLocator(action, path, issues);
                if (!action.TryGetProperty("value", out var value) ||
                    value.ValueKind != JsonValueKind.String)
                {
                    issues.Add(new RecipeValidationIssue(
                        Codes.ActionFieldMissing, path + ".value",
                        "'" + verb + "' requires a string value."));
                }
                else
                {
                    ValidatePlaceholders(value.GetString(), path + ".value", variables, issues);
                }

                break;

            case RecipeSchemaV2.Actions.Press:
                RequireLocator(action, path, issues);
                if (!action.TryGetProperty("key", out var key) ||
                    key.ValueKind != JsonValueKind.String ||
                    key.GetString()!.Length == 0)
                {
                    issues.Add(new RecipeValidationIssue(
                        Codes.ActionFieldMissing, path + ".key",
                        "'press' requires 'key'; it is the only accepted name for the keyboard key."));
                }

                break;

            case RecipeSchemaV2.Actions.Wait:
                if (!action.TryGetProperty("duration_ms", out var duration) ||
                    duration.ValueKind != JsonValueKind.Number ||
                    !duration.TryGetInt32(out var durationMs) ||
                    durationMs < 1 || durationMs > 120000)
                {
                    issues.Add(new RecipeValidationIssue(
                        Codes.ActionFieldMissing, path + ".duration_ms",
                        "'wait' requires duration_ms between 1 and 120000; timeout_ms is a different field."));
                }

                break;

            default:
                RequireLocator(action, path, issues);
                break;
        }
    }

    private static void RequireTemplateString(
        JsonElement action,
        string property,
        string path,
        VariableCatalog variables,
        List<RecipeValidationIssue> issues)
    {
        if (!action.TryGetProperty(property, out var element) ||
            element.ValueKind != JsonValueKind.String ||
            element.GetString()!.Length == 0)
        {
            issues.Add(new RecipeValidationIssue(
                Codes.ActionFieldMissing, path + "." + property,
                "'" + property + "' is required and must be a non-empty string."));
            return;
        }

        ValidatePlaceholders(element.GetString(), path + "." + property, variables, issues);
    }

    private static void ValidatePlaceholders(
        string? text, string path, VariableCatalog variables, List<RecipeValidationIssue> issues)
    {
        if (string.IsNullOrEmpty(text)) return;

        foreach (Match match in PlaceholderPattern.Matches(text))
        {
            var name = match.Groups[1].Value;
            if (!variables.Names.Contains(name))
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.VariableReferenceUnknown, path,
                    "'{{" + name + "}}' does not match any declared variable."));
            }
        }
    }

    // ── locator ─────────────────────────────────────────────────────────────────────────────

    private static void RequireLocator(JsonElement owner, string path, List<RecipeValidationIssue> issues)
    {
        if (!owner.TryGetProperty("locator", out var locator))
        {
            issues.Add(new RecipeValidationIssue(
                Codes.LocatorMissing, path + ".locator",
                "A structured locator is required; Playwright source strings are not accepted."));
            return;
        }

        ValidateLocator(locator, path + ".locator", issues);
    }

    private static void ValidateLocator(
        JsonElement locator, string path, List<RecipeValidationIssue> issues)
    {
        if (locator.ValueKind != JsonValueKind.Object)
        {
            issues.Add(new RecipeValidationIssue(
                Codes.LocatorMissing, path, "A locator must be an object."));
            return;
        }

        var strategy = ReadString(locator, "strategy");
        if (strategy == null || !KnownStrategies.Contains(strategy))
        {
            issues.Add(new RecipeValidationIssue(
                Codes.LocatorStrategyUnknown, path + ".strategy",
                "'" + (strategy ?? "<missing>") + "' is not a known locator strategy (" +
                string.Join(", ", RecipeSchemaV2.LocatorStrategies.All) + ")."));
            return;
        }

        if (strategy == RecipeSchemaV2.LocatorStrategies.Role)
        {
            RejectUnknownProperties(
                locator,
                new HashSet<string>(new[] { "strategy", "role", "name", "exact" }, StringComparer.Ordinal),
                path,
                issues);

            var role = ReadString(locator, "role");
            if (string.IsNullOrEmpty(role))
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.LocatorFieldMissing, path + ".role",
                    "A role locator requires the ARIA role."));
            }
        }
        else
        {
            RejectUnknownProperties(
                locator,
                new HashSet<string>(new[] { "strategy", "value", "exact" }, StringComparer.Ordinal),
                path,
                issues);

            var value = ReadString(locator, "value");
            if (string.IsNullOrEmpty(value))
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.LocatorFieldMissing, path + ".value",
                    "A '" + strategy + "' locator requires a non-empty value."));
            }
        }
    }

    // ── condition ───────────────────────────────────────────────────────────────────────────

    /// <returns>True when the action declares a condition, whether or not it validated.</returns>
    private static bool ValidateCondition(
        JsonElement action, string path, List<RecipeValidationIssue> issues)
    {
        if (!action.TryGetProperty("condition", out var condition)) return false;

        var conditionPath = path + ".condition";

        if (condition.ValueKind != JsonValueKind.Object)
        {
            issues.Add(new RecipeValidationIssue(
                Codes.ConditionTypeUnknown, conditionPath, "A condition must be an object."));
            return true;
        }

        var type = ReadString(condition, "type");
        if (type == null || !KnownConditionTypes.Contains(type))
        {
            // Fail-closed: an unrecognised gate is rejected here so it can never be silently
            // treated as "always run" at execution time.
            issues.Add(new RecipeValidationIssue(
                Codes.ConditionTypeUnknown, conditionPath + ".type",
                "'" + (type ?? "<missing>") + "' is not a known condition type (" +
                string.Join(", ", RecipeSchemaV2.ConditionTypes.All) + ")."));
            return true;
        }

        if (type == RecipeSchemaV2.ConditionTypes.UrlMatches)
        {
            RejectUnknownProperties(
                condition,
                new HashSet<string>(new[] { "type", "pattern", "check_timeout_ms" }, StringComparer.Ordinal),
                conditionPath,
                issues);

            var pattern = ReadString(condition, "pattern");
            if (string.IsNullOrEmpty(pattern))
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.ConditionFieldMissing, conditionPath + ".pattern",
                    "A url_matches condition requires a non-empty pattern."));
            }
        }
        else
        {
            RejectUnknownProperties(
                condition,
                new HashSet<string>(new[] { "type", "locator", "check_timeout_ms" }, StringComparer.Ordinal),
                conditionPath,
                issues);

            if (!condition.TryGetProperty("locator", out var locator))
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.ConditionFieldMissing, conditionPath + ".locator",
                    "A '" + type + "' condition requires a locator."));
            }
            else
            {
                ValidateLocator(locator, conditionPath + ".locator", issues);
            }
        }

        RequireIntegerIfPresent(condition, "check_timeout_ms", conditionPath, 0, 120000, issues);
        return true;
    }

    // ── edges and graph ─────────────────────────────────────────────────────────────────────

    private static void ValidateEdgesAndGraph(
        JsonElement root, List<ActionNode> actions, List<RecipeValidationIssue> issues)
    {
        if (actions.Count == 0) return;

        var byId = new Dictionary<string, ActionNode>(StringComparer.Ordinal);
        foreach (var node in actions)
        {
            byId[node.Id] = node;
        }

        var adjacency = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        var hasIncoming = new HashSet<string>(StringComparer.Ordinal);
        var edgeCount = 0;

        if (root.TryGetProperty(RecipeSchemaV2.Properties.Edges, out var edges))
        {
            if (edges.ValueKind != JsonValueKind.Array)
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.EdgeEndpointUnknown, RecipeSchemaV2.Properties.Edges,
                    "edges must be an array."));
                return;
            }

            var index = 0;
            foreach (var edge in edges.EnumerateArray())
            {
                var path = "edges[" + index.ToString(CultureInfo.InvariantCulture) + "]";
                index++;
                edgeCount++;

                if (edge.ValueKind != JsonValueKind.Object)
                {
                    issues.Add(new RecipeValidationIssue(
                        Codes.EdgeEndpointUnknown, path, "Each edge must be an object."));
                    continue;
                }

                RejectUnknownProperties(
                    edge,
                    new HashSet<string>(new[] { "from", "to", "branch" }, StringComparer.Ordinal),
                    path,
                    issues);

                var from = ReadString(edge, "from");
                var to = ReadString(edge, "to");

                if (from == null || !byId.ContainsKey(from))
                {
                    issues.Add(new RecipeValidationIssue(
                        Codes.EdgeEndpointUnknown, path + ".from",
                        "Edge source '" + (from ?? "<missing>") + "' is not a declared action id."));
                }

                if (to == null || !byId.ContainsKey(to))
                {
                    issues.Add(new RecipeValidationIssue(
                        Codes.EdgeEndpointUnknown, path + ".to",
                        "Edge target '" + (to ?? "<missing>") + "' is not a declared action id."));
                }

                var branch = edge.TryGetProperty("branch", out var branchElement)
                    ? (branchElement.ValueKind == JsonValueKind.String ? branchElement.GetString() : null)
                    : RecipeSchemaV2.EdgeBranches.Default;

                if (branch == null || !KnownBranches.Contains(branch))
                {
                    issues.Add(new RecipeValidationIssue(
                        Codes.EdgeBranchUnknown, path + ".branch",
                        "'" + (branch ?? "<invalid>") + "' is not a known branch (" +
                        string.Join(", ", RecipeSchemaV2.EdgeBranches.All) + ")."));
                    continue;
                }

                if (from == null || to == null || !byId.TryGetValue(from, out var source) || !byId.ContainsKey(to))
                {
                    continue;
                }

                var isBranchExit = branch != RecipeSchemaV2.EdgeBranches.Next;

                if (isBranchExit && !source.IsConditional)
                {
                    issues.Add(new RecipeValidationIssue(
                        Codes.EdgeBranchWithoutCondition, path + ".branch",
                        "A '" + branch + "' edge may only leave an action that declares a condition."));
                }
                else if (!isBranchExit && source.IsConditional)
                {
                    issues.Add(new RecipeValidationIssue(
                        Codes.EdgeBranchOnConditional, path + ".branch",
                        "A conditional action must route through 'true'/'false' edges; " +
                        "'next' would make the outcome of the condition unobservable."));
                }

                hasIncoming.Add(to);
                if (!adjacency.TryGetValue(from, out var targets))
                {
                    targets = new List<string>();
                    adjacency[from] = targets;
                }

                targets.Add(to);
            }
        }

        if (edgeCount == 0)
        {
            // No edges means strictly linear execution in array order: the first action is the
            // root and every action is reachable by construction.
            return;
        }

        var roots = new List<string>();
        foreach (var node in actions)
        {
            if (!hasIncoming.Contains(node.Id)) roots.Add(node.Id);
        }

        if (roots.Count == 0)
        {
            issues.Add(new RecipeValidationIssue(
                Codes.GraphNoRoot, RecipeSchemaV2.Properties.Edges,
                "Every action has an incoming edge, so the graph has no entry point."));
            return;
        }

        if (roots.Count > 1)
        {
            issues.Add(new RecipeValidationIssue(
                Codes.GraphMultipleRoots, RecipeSchemaV2.Properties.Edges,
                "The graph has " + roots.Count + " entry points (" + string.Join(", ", roots) +
                "); exactly one is required."));
            return;
        }

        var reachable = new HashSet<string>(StringComparer.Ordinal);
        if (HasCycle(roots[0], adjacency, reachable))
        {
            issues.Add(new RecipeValidationIssue(
                Codes.GraphCycle, RecipeSchemaV2.Properties.Edges,
                "The execution graph contains a cycle."));
            return;
        }

        foreach (var node in actions)
        {
            if (!node.IsOptional && !reachable.Contains(node.Id))
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.GraphOrphanRequired, "actions",
                    "Action '" + node.Id + "' is required but unreachable from the entry point."));
            }
        }
    }

    /// <summary>
    /// Iterative depth-first walk that both detects cycles and collects the reachable set.
    /// Iterative rather than recursive so a pathological recipe cannot overflow the stack.
    /// </summary>
    private static bool HasCycle(
        string root, Dictionary<string, List<string>> adjacency, HashSet<string> reachable)
    {
        var onPath = new HashSet<string>(StringComparer.Ordinal);
        var stack = new Stack<KeyValuePair<string, int>>();

        stack.Push(new KeyValuePair<string, int>(root, 0));
        reachable.Add(root);
        onPath.Add(root);

        while (stack.Count > 0)
        {
            var frame = stack.Pop();
            var node = frame.Key;
            var next = frame.Value;

            adjacency.TryGetValue(node, out var targets);

            if (targets == null || next >= targets.Count)
            {
                onPath.Remove(node);
                continue;
            }

            stack.Push(new KeyValuePair<string, int>(node, next + 1));

            var child = targets[next];
            if (onPath.Contains(child)) return true;

            if (reachable.Add(child))
            {
                onPath.Add(child);
                stack.Push(new KeyValuePair<string, int>(child, 0));
            }
        }

        return false;
    }

    // ── completion ──────────────────────────────────────────────────────────────────────────

    private static void ValidateCompletion(
        JsonElement root, VariableCatalog variables, List<RecipeValidationIssue> issues)
    {
        if (!root.TryGetProperty(RecipeSchemaV2.Properties.Completion, out var completion))
        {
            issues.Add(new RecipeValidationIssue(
                Codes.CompletionMissing, RecipeSchemaV2.Properties.Completion,
                "A recipe without a completion block can never prove the portal finished."));
            return;
        }

        if (completion.ValueKind != JsonValueKind.Object)
        {
            issues.Add(new RecipeValidationIssue(
                Codes.CompletionMissing, RecipeSchemaV2.Properties.Completion,
                "completion must be an object."));
            return;
        }

        RejectUnknownProperties(
            completion,
            new HashSet<string>(new[] { "mode", "assertions", "delivery" }, StringComparer.Ordinal),
            RecipeSchemaV2.Properties.Completion,
            issues);

        if (completion.TryGetProperty("mode", out var mode))
        {
            var modeValue = mode.ValueKind == JsonValueKind.String ? mode.GetString() : null;
            if (modeValue == null || !KnownCompletionModes.Contains(modeValue))
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.CompletionModeUnknown, "completion.mode",
                    "'" + (modeValue ?? "<invalid>") + "' is not a known completion mode (" +
                    string.Join(", ", RecipeSchemaV2.CompletionModes.Values) + ")."));
            }
        }

        ValidateAssertions(completion, issues);
        ValidateDelivery(completion, variables, issues);
    }

    private static void ValidateAssertions(JsonElement completion, List<RecipeValidationIssue> issues)
    {
        if (!completion.TryGetProperty("assertions", out var assertions) ||
            assertions.ValueKind != JsonValueKind.Array ||
            assertions.GetArrayLength() == 0)
        {
            issues.Add(new RecipeValidationIssue(
                Codes.AssertionsMissing, "completion.assertions",
                "At least one terminal assertion is required; finishing the last step is not proof."));
            return;
        }

        var index = 0;
        foreach (var assertion in assertions.EnumerateArray())
        {
            var path = "completion.assertions[" + index.ToString(CultureInfo.InvariantCulture) + "]";
            index++;

            if (assertion.ValueKind != JsonValueKind.Object)
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.AssertionTypeUnknown, path, "Each assertion must be an object."));
                continue;
            }

            var type = ReadString(assertion, "type");
            if (type == null || !KnownAssertionTypes.Contains(type))
            {
                issues.Add(new RecipeValidationIssue(
                    Codes.AssertionTypeUnknown, path + ".type",
                    "'" + (type ?? "<missing>") + "' is not a known assertion type (" +
                    string.Join(", ", RecipeSchemaV2.AssertionTypes.All) + ")."));
                continue;
            }

            if (type == RecipeSchemaV2.AssertionTypes.SelectorText)
            {
                RejectUnknownProperties(
                    assertion,
                    new HashSet<string>(new[] { "type", "locator", "contains" }, StringComparer.Ordinal),
                    path,
                    issues);

                if (!assertion.TryGetProperty("locator", out var locator))
                {
                    issues.Add(new RecipeValidationIssue(
                        Codes.AssertionFieldMissing, path + ".locator",
                        "A selector_text assertion requires a locator."));
                }
                else
                {
                    ValidateLocator(locator, path + ".locator", issues);
                }

                var contains = ReadString(assertion, "contains");
                if (string.IsNullOrEmpty(contains))
                {
                    issues.Add(new RecipeValidationIssue(
                        Codes.AssertionFieldMissing, path + ".contains",
                        "A selector_text assertion requires the text the portal must show."));
                }
            }
            else
            {
                RejectUnknownProperties(
                    assertion,
                    new HashSet<string>(new[] { "type", "pattern" }, StringComparer.Ordinal),
                    path,
                    issues);

                var pattern = ReadString(assertion, "pattern");
                if (string.IsNullOrEmpty(pattern))
                {
                    issues.Add(new RecipeValidationIssue(
                        Codes.AssertionFieldMissing, path + ".pattern",
                        "A url_matches assertion requires a non-empty pattern."));
                }
            }
        }
    }

    private static void ValidateDelivery(
        JsonElement completion, VariableCatalog variables, List<RecipeValidationIssue> issues)
    {
        if (!completion.TryGetProperty("delivery", out var delivery)) return;

        const string path = "completion.delivery";

        if (delivery.ValueKind != JsonValueKind.Object)
        {
            issues.Add(new RecipeValidationIssue(
                Codes.DeliveryModeUnknown, path, "delivery must be an object."));
            return;
        }

        var mode = ReadString(delivery, "mode");
        if (mode == null || !KnownDeliveryModes.Contains(mode))
        {
            issues.Add(new RecipeValidationIssue(
                Codes.DeliveryModeUnknown, path + ".mode",
                "'" + (mode ?? "<missing>") + "' is not a known delivery mode (" +
                string.Join(", ", RecipeSchemaV2.DeliveryModes.All) + ")."));
            return;
        }

        if (mode != RecipeSchemaV2.DeliveryModes.PortalEmail)
        {
            RejectUnknownProperties(
                delivery,
                new HashSet<string>(new[] { "mode" }, StringComparer.Ordinal),
                path,
                issues);
            return;
        }

        RejectUnknownProperties(
            delivery,
            new HashSet<string>(new[] { "mode", "destination_binding" }, StringComparer.Ordinal),
            path,
            issues);

        var binding = ReadString(delivery, "destination_binding");
        if (string.IsNullOrEmpty(binding))
        {
            issues.Add(new RecipeValidationIssue(
                Codes.DeliveryBindingMissing, path + ".destination_binding",
                "portal_email delivery must state which address the portal was given."));
            return;
        }

        if (!VariableSourcePattern.IsMatch(binding!))
        {
            issues.Add(new RecipeValidationIssue(
                Codes.DeliveryBindingUnresolvable, path + ".destination_binding",
                "'" + binding + "' is not a canonical source."));
            return;
        }

        if (!variables.Sources.Contains(binding!))
        {
            // The binding has to be resolvable from data the recipe actually collects, otherwise
            // the evidence would name an address the run never used.
            issues.Add(new RecipeValidationIssue(
                Codes.DeliveryBindingUnresolvable, path + ".destination_binding",
                "No declared variable resolves '" + binding + "'."));
        }
    }

    // ── shared helpers ──────────────────────────────────────────────────────────────────────

    private static void RejectUnknownProperties(
        JsonElement element,
        HashSet<string> allowed,
        string path,
        List<RecipeValidationIssue> issues)
    {
        foreach (var property in element.EnumerateObject())
        {
            if (allowed.Contains(property.Name)) continue;

            issues.Add(new RecipeValidationIssue(
                Codes.UnknownProperty,
                string.IsNullOrEmpty(path) ? property.Name : path + "." + property.Name,
                "'" + property.Name + "' is not part of the v2 contract."));
        }
    }

    private static void RequireIntegerIfPresent(
        JsonElement owner,
        string property,
        string path,
        int min,
        int max,
        List<RecipeValidationIssue> issues)
    {
        if (!owner.TryGetProperty(property, out var element)) return;

        if (element.ValueKind != JsonValueKind.Number ||
            !element.TryGetInt32(out var value) ||
            value < min || value > max)
        {
            issues.Add(new RecipeValidationIssue(
                Codes.ActionFieldInvalid, path + "." + property,
                property + " must be an integer between " + min + " and " + max + "."));
        }
    }

    private static string? ReadString(JsonElement owner, string property) =>
        owner.TryGetProperty(property, out var element) && element.ValueKind == JsonValueKind.String
            ? element.GetString()
            : null;
}
