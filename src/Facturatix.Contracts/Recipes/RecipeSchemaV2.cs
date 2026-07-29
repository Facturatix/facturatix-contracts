using System.Collections.Generic;

namespace Facturatix.Contracts.Recipes;

/// <summary>
/// Canonical vocabulary of the recipe execution contract v2.
/// <para>
/// These constants are the C# mirror of <c>schemas/recipe-execution.schema.v2.json</c>,
/// which ships in the same package. Both are consumed by facturatix-api (validation and
/// storage), facturatix-generator (execution) and — through the npm twin of this package —
/// facturatix-modeler (authoring). A value that exists in one and not in the other is a
/// contract break and is caught by the schema/constant parity tests in every consumer.
/// </para>
/// </summary>
public static class RecipeSchemaV2
{
    /// <summary>Value of the <c>schema_version</c> property for this contract.</summary>
    public const int Version = 2;

    /// <summary>File name of the JSON Schema shipped with this package.</summary>
    public const string SchemaFileName = "recipe-execution.schema.v2.json";

    /// <summary>
    /// Verbs the executor is allowed to run.
    /// <para>
    /// Deliberately excluded: <c>dialog_accept</c>, <c>dialog_dismiss</c>, <c>popup</c>,
    /// <c>custom</c>, <c>upload</c>, <c>dblclick</c> — they have no tested implementation in the
    /// Generator, so allowing them would guarantee a false success. <c>download</c> is excluded
    /// permanently: Facturatix does not handle fiscal files.
    /// </para>
    /// </summary>
    public static class Actions
    {
        public const string Goto = "goto";
        public const string Click = "click";
        public const string Fill = "fill";
        public const string Select = "select";
        public const string Check = "check";
        public const string Uncheck = "uncheck";
        public const string Press = "press";
        public const string Wait = "wait";
        public const string WaitSelector = "wait_selector";

        /// <summary>Every verb accepted by the contract, in schema order.</summary>
        public static readonly IReadOnlyList<string> All = new[]
        {
            Goto, Click, Fill, Select, Check, Uncheck, Press, Wait, WaitSelector
        };
    }

    /// <summary>How an element is addressed. Playwright source strings are never a locator.</summary>
    public static class LocatorStrategies
    {
        public const string Role = "role";
        public const string Css = "css";
        public const string Label = "label";
        public const string Text = "text";
        public const string TestId = "test_id";

        public static readonly IReadOnlyList<string> All = new[] { Role, Css, Label, Text, TestId };

        /// <summary>Strategies whose target is carried in the <c>value</c> property.</summary>
        public static readonly IReadOnlyList<string> ValueBased = new[] { Css, Label, Text, TestId };
    }

    /// <summary>Gates evaluated before an action runs. An unknown type invalidates the recipe.</summary>
    public static class ConditionTypes
    {
        public const string ElementExists = "element_exists";
        public const string ElementAbsent = "element_absent";
        public const string UrlMatches = "url_matches";

        public static readonly IReadOnlyList<string> All = new[]
        {
            ElementExists, ElementAbsent, UrlMatches
        };
    }

    /// <summary>Terminal evidence the portal must show for a ticket to reach <c>completed</c>.</summary>
    public static class AssertionTypes
    {
        public const string SelectorText = "selector_text";
        public const string UrlMatches = "url_matches";

        public static readonly IReadOnlyList<string> All = new[] { SelectorText, UrlMatches };
    }

    /// <summary>How the portal states it delivered the invoice.</summary>
    public static class DeliveryModes
    {
        /// <summary>The portal declared it sent the invoice to an e-mail address.</summary>
        public const string PortalEmail = "portal_email";

        /// <summary>The portal only displayed a confirmation; no delivery channel was stated.</summary>
        public const string PortalConfirmation = "portal_confirmation";

        public static readonly IReadOnlyList<string> All = new[] { PortalEmail, PortalConfirmation };
    }

    /// <summary>How the assertion list is combined.</summary>
    public static class CompletionModes
    {
        public const string All = "all";
        public const string Any = "any";

        public const string Default = All;

        public static readonly IReadOnlyList<string> Values = new[] { All, Any };
    }

    /// <summary>Branch label of an execution edge.</summary>
    public static class EdgeBranches
    {
        public const string Next = "next";
        public const string True = "true";
        public const string False = "false";

        public const string Default = Next;

        public static readonly IReadOnlyList<string> All = new[] { Next, True, False };
    }

    /// <summary>
    /// Namespaces a variable value may come from. Anything else is rejected at validation time,
    /// so the executor never has to guess where a value should have come from.
    /// </summary>
    public static class VariableSources
    {
        /// <summary>Account-level data (e.g. <c>user.email</c>).</summary>
        public const string UserPrefix = "user.";

        /// <summary>Fiscal profile data (e.g. <c>user.fiscal.rfc</c>).</summary>
        public const string UserFiscalPrefix = "user.fiscal.";

        /// <summary>Data extracted from the ticket image (e.g. <c>ticket.extracted.total</c>).</summary>
        public const string TicketExtractedPrefix = "ticket.extracted.";

        /// <summary>The e-mail address a portal delivers the invoice to.</summary>
        public const string UserFiscalEmail = "user.fiscal.email";

        /// <summary>The tax id used to request the invoice.</summary>
        public const string UserFiscalTaxId = "user.fiscal.rfc";

        public static readonly IReadOnlyList<string> Prefixes = new[]
        {
            UserFiscalPrefix, TicketExtractedPrefix, UserPrefix
        };
    }

    /// <summary>Top-level property names of the contract document.</summary>
    public static class Properties
    {
        public const string SchemaVersion = "schema_version";
        public const string Variables = "variables";
        public const string BrowserDefaults = "browser_defaults";
        public const string Actions = "actions";
        public const string Edges = "edges";
        public const string Completion = "completion";
        public const string UiMetadata = "ui_metadata";

        public static readonly IReadOnlyList<string> All = new[]
        {
            SchemaVersion, Variables, BrowserDefaults, Actions, Edges, Completion, UiMetadata
        };
    }

    /// <summary>
    /// Stable identifiers for every way a document can fail validation. They travel to the
    /// Modeler inside <c>validation_failed</c> responses, so renaming one is a breaking change.
    /// </summary>
    public static class ValidationCodes
    {
        public const string InvalidJson = "invalid_json";
        public const string RootNotObject = "root_not_object";
        public const string UnknownProperty = "unknown_property";
        public const string SchemaVersionMissing = "schema_version_missing";
        public const string SchemaVersionUnsupported = "schema_version_unsupported";

        public const string VariableInvalid = "variable_invalid";
        public const string VariableNameDuplicate = "variable_name_duplicate";
        public const string VariableSourceUnknown = "variable_source_unknown";
        public const string VariableReferenceUnknown = "variable_reference_unknown";

        public const string ActionsMissing = "actions_missing";
        public const string ActionsEmpty = "actions_empty";
        public const string ActionIdMissing = "action_id_missing";
        public const string ActionIdDuplicate = "action_id_duplicate";
        public const string ActionTypeUnknown = "action_type_unknown";
        public const string ActionFieldMissing = "action_field_missing";
        public const string ActionFieldInvalid = "action_field_invalid";

        public const string LocatorMissing = "locator_missing";
        public const string LocatorStrategyUnknown = "locator_strategy_unknown";
        public const string LocatorFieldMissing = "locator_field_missing";

        public const string ConditionTypeUnknown = "condition_type_unknown";
        public const string ConditionFieldMissing = "condition_field_missing";

        public const string EdgeEndpointUnknown = "edge_endpoint_unknown";
        public const string EdgeBranchUnknown = "edge_branch_unknown";
        public const string EdgeBranchWithoutCondition = "edge_branch_without_condition";
        public const string EdgeBranchOnConditional = "edge_branch_on_conditional";
        public const string GraphNoRoot = "graph_no_root";
        public const string GraphMultipleRoots = "graph_multiple_roots";
        public const string GraphCycle = "graph_cycle";
        public const string GraphOrphanRequired = "graph_orphan_required";

        public const string CompletionMissing = "completion_missing";
        public const string CompletionModeUnknown = "completion_mode_unknown";
        public const string AssertionsMissing = "assertions_missing";
        public const string AssertionTypeUnknown = "assertion_type_unknown";
        public const string AssertionFieldMissing = "assertion_field_missing";
        public const string DeliveryModeUnknown = "delivery_mode_unknown";
        public const string DeliveryBindingMissing = "delivery_binding_missing";
        public const string DeliveryBindingUnresolvable = "delivery_binding_unresolvable";
    }
}
