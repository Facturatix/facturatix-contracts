/**
 * Canonical vocabulary of the recipe execution contract v2.
 *
 * TypeScript mirror of `Facturatix.Contracts.Recipes.RecipeSchemaV2`. The two must stay identical:
 * the Modeler authors documents with these values and the API rejects anything the C# constants do
 * not recognise, so a divergence shows up as a recipe that publishes locally and fails on the
 * server. The shared fixtures under `schemas/fixtures/` are what keeps them honest.
 *
 * @module
 */

/** Value of the `schema_version` property for this contract. */
export const SCHEMA_VERSION = 2

/** File name of the JSON Schema shipped with this package. */
export const SCHEMA_FILE_NAME = 'recipe-execution.schema.v2.json'

/**
 * Verbs the executor is allowed to run.
 *
 * Deliberately excluded: `dialog_accept`, `dialog_dismiss`, `popup`, `custom`, `upload`,
 * `dblclick` — they have no tested implementation in the Generator, so allowing them would
 * guarantee a false success. `download` is excluded permanently: Facturatix does not handle
 * fiscal files.
 */
export const ACTIONS = {
  GOTO: 'goto',
  CLICK: 'click',
  FILL: 'fill',
  SELECT: 'select',
  CHECK: 'check',
  UNCHECK: 'uncheck',
  PRESS: 'press',
  WAIT: 'wait',
  WAIT_SELECTOR: 'wait_selector'
} as const

/** Every verb accepted by the contract, in schema order. */
export const ALL_ACTIONS: readonly string[] = [
  ACTIONS.GOTO,
  ACTIONS.CLICK,
  ACTIONS.FILL,
  ACTIONS.SELECT,
  ACTIONS.CHECK,
  ACTIONS.UNCHECK,
  ACTIONS.PRESS,
  ACTIONS.WAIT,
  ACTIONS.WAIT_SELECTOR
]

/** How an element is addressed. Playwright source strings are never a locator. */
export const LOCATOR_STRATEGIES = {
  ROLE: 'role',
  CSS: 'css',
  LABEL: 'label',
  TEXT: 'text',
  TEST_ID: 'test_id'
} as const

export const ALL_LOCATOR_STRATEGIES: readonly string[] = [
  LOCATOR_STRATEGIES.ROLE,
  LOCATOR_STRATEGIES.CSS,
  LOCATOR_STRATEGIES.LABEL,
  LOCATOR_STRATEGIES.TEXT,
  LOCATOR_STRATEGIES.TEST_ID
]

/** Strategies whose target is carried in the `value` property. */
export const VALUE_BASED_LOCATOR_STRATEGIES: readonly string[] = [
  LOCATOR_STRATEGIES.CSS,
  LOCATOR_STRATEGIES.LABEL,
  LOCATOR_STRATEGIES.TEXT,
  LOCATOR_STRATEGIES.TEST_ID
]

/** Gates evaluated before an action runs. An unknown type invalidates the recipe. */
export const CONDITION_TYPES = {
  ELEMENT_EXISTS: 'element_exists',
  ELEMENT_ABSENT: 'element_absent',
  URL_MATCHES: 'url_matches'
} as const

export const ALL_CONDITION_TYPES: readonly string[] = [
  CONDITION_TYPES.ELEMENT_EXISTS,
  CONDITION_TYPES.ELEMENT_ABSENT,
  CONDITION_TYPES.URL_MATCHES
]

/** Terminal evidence the portal must show for a ticket to reach `completed`. */
export const ASSERTION_TYPES = {
  SELECTOR_TEXT: 'selector_text',
  URL_MATCHES: 'url_matches'
} as const

export const ALL_ASSERTION_TYPES: readonly string[] = [
  ASSERTION_TYPES.SELECTOR_TEXT,
  ASSERTION_TYPES.URL_MATCHES
]

/** How the portal states it delivered the invoice. */
export const DELIVERY_MODES = {
  /** The portal declared it sent the invoice to an e-mail address. */
  PORTAL_EMAIL: 'portal_email',
  /** The portal only displayed a confirmation; no delivery channel was stated. */
  PORTAL_CONFIRMATION: 'portal_confirmation'
} as const

export const ALL_DELIVERY_MODES: readonly string[] = [
  DELIVERY_MODES.PORTAL_EMAIL,
  DELIVERY_MODES.PORTAL_CONFIRMATION
]

/** How the assertion list is combined. */
export const COMPLETION_MODES = {
  ALL: 'all',
  ANY: 'any'
} as const

export const DEFAULT_COMPLETION_MODE = COMPLETION_MODES.ALL

export const ALL_COMPLETION_MODES: readonly string[] = [
  COMPLETION_MODES.ALL,
  COMPLETION_MODES.ANY
]

/** Branch label of an execution edge. */
export const EDGE_BRANCHES = {
  NEXT: 'next',
  TRUE: 'true',
  FALSE: 'false'
} as const

export const DEFAULT_EDGE_BRANCH = EDGE_BRANCHES.NEXT

export const ALL_EDGE_BRANCHES: readonly string[] = [
  EDGE_BRANCHES.NEXT,
  EDGE_BRANCHES.TRUE,
  EDGE_BRANCHES.FALSE
]

/**
 * Namespaces a variable value may come from. Anything else is rejected at validation time, so the
 * executor never has to guess where a value should have come from.
 */
export const VARIABLE_SOURCES = {
  USER_PREFIX: 'user.',
  USER_FISCAL_PREFIX: 'user.fiscal.',
  TICKET_EXTRACTED_PREFIX: 'ticket.extracted.',
  USER_FISCAL_EMAIL: 'user.fiscal.email',
  USER_FISCAL_TAX_ID: 'user.fiscal.rfc'
} as const

/** Top-level property names of the contract document. */
export const ROOT_PROPERTIES = {
  SCHEMA_VERSION: 'schema_version',
  VARIABLES: 'variables',
  BROWSER_DEFAULTS: 'browser_defaults',
  ACTIONS: 'actions',
  EDGES: 'edges',
  COMPLETION: 'completion',
  UI_METADATA: 'ui_metadata'
} as const

export const ALL_ROOT_PROPERTIES: readonly string[] = [
  ROOT_PROPERTIES.SCHEMA_VERSION,
  ROOT_PROPERTIES.VARIABLES,
  ROOT_PROPERTIES.BROWSER_DEFAULTS,
  ROOT_PROPERTIES.ACTIONS,
  ROOT_PROPERTIES.EDGES,
  ROOT_PROPERTIES.COMPLETION,
  ROOT_PROPERTIES.UI_METADATA
]

/**
 * Stable identifiers for every way a document can fail validation. They travel to the Modeler
 * inside `validation_failed` responses, so renaming one is a breaking change.
 */
export const VALIDATION_CODES = {
  INVALID_JSON: 'invalid_json',
  ROOT_NOT_OBJECT: 'root_not_object',
  UNKNOWN_PROPERTY: 'unknown_property',
  SCHEMA_VERSION_MISSING: 'schema_version_missing',
  SCHEMA_VERSION_UNSUPPORTED: 'schema_version_unsupported',

  VARIABLE_INVALID: 'variable_invalid',
  VARIABLE_NAME_DUPLICATE: 'variable_name_duplicate',
  VARIABLE_SOURCE_UNKNOWN: 'variable_source_unknown',
  VARIABLE_REFERENCE_UNKNOWN: 'variable_reference_unknown',

  ACTIONS_MISSING: 'actions_missing',
  ACTIONS_EMPTY: 'actions_empty',
  ACTION_ID_MISSING: 'action_id_missing',
  ACTION_ID_DUPLICATE: 'action_id_duplicate',
  ACTION_TYPE_UNKNOWN: 'action_type_unknown',
  ACTION_FIELD_MISSING: 'action_field_missing',
  ACTION_FIELD_INVALID: 'action_field_invalid',

  LOCATOR_MISSING: 'locator_missing',
  LOCATOR_STRATEGY_UNKNOWN: 'locator_strategy_unknown',
  LOCATOR_FIELD_MISSING: 'locator_field_missing',

  CONDITION_TYPE_UNKNOWN: 'condition_type_unknown',
  CONDITION_FIELD_MISSING: 'condition_field_missing',

  EDGE_ENDPOINT_UNKNOWN: 'edge_endpoint_unknown',
  EDGE_BRANCH_UNKNOWN: 'edge_branch_unknown',
  EDGE_BRANCH_WITHOUT_CONDITION: 'edge_branch_without_condition',
  EDGE_BRANCH_ON_CONDITIONAL: 'edge_branch_on_conditional',
  GRAPH_NO_ROOT: 'graph_no_root',
  GRAPH_MULTIPLE_ROOTS: 'graph_multiple_roots',
  GRAPH_CYCLE: 'graph_cycle',
  GRAPH_ORPHAN_REQUIRED: 'graph_orphan_required',

  COMPLETION_MISSING: 'completion_missing',
  COMPLETION_MODE_UNKNOWN: 'completion_mode_unknown',
  ASSERTIONS_MISSING: 'assertions_missing',
  ASSERTION_TYPE_UNKNOWN: 'assertion_type_unknown',
  ASSERTION_FIELD_MISSING: 'assertion_field_missing',
  DELIVERY_MODE_UNKNOWN: 'delivery_mode_unknown',
  DELIVERY_BINDING_MISSING: 'delivery_binding_missing',
  DELIVERY_BINDING_UNRESOLVABLE: 'delivery_binding_unresolvable'
} as const

// ── Document shape ──────────────────────────────────────────────────────────────────────────

/** Structured element reference. */
export interface RecipeLocator {
  strategy: string
  /** ARIA role — `role` strategy only. */
  role?: string
  /** Accessible name — `role` strategy only. */
  name?: string
  /** Target of the `css` / `label` / `text` / `test_id` strategies. */
  value?: string
  exact?: boolean
}

/** Gate evaluated before an action runs. */
export interface RecipeCondition {
  type: string
  locator?: RecipeLocator
  pattern?: string
  check_timeout_ms?: number
}

/** A single executable step. */
export interface RecipeAction {
  id: string
  action: string
  description?: string
  optional?: boolean
  timeout_ms?: number
  continue_on_error?: boolean
  retry_count?: number
  retry_delay_ms?: number
  condition?: RecipeCondition
  locator?: RecipeLocator
  value?: string
  url?: string
  key?: string
  duration_ms?: number
}

/** Execution graph link. */
export interface RecipeEdge {
  from: string
  to: string
  branch?: string
}

/** A value resolved before execution. */
export interface RecipeVariable {
  name: string
  source: string
  required?: boolean
  pattern?: string
  description?: string
}

/** Terminal evidence the portal must show. */
export interface RecipeAssertion {
  type: string
  locator?: RecipeLocator
  contains?: string
  pattern?: string
}

/** How the portal stated it delivered the invoice. */
export interface RecipeDelivery {
  mode: string
  destination_binding?: string
}

/** The completion criterion. Without it a run can never be proven finished. */
export interface RecipeCompletion {
  mode?: string
  assertions: RecipeAssertion[]
  delivery?: RecipeDelivery
}

/** Browser context defaults for the run. */
export interface RecipeBrowserDefaults {
  viewport_width?: number
  viewport_height?: number
  locale?: string
  timezone?: string
}

/** A complete v2 recipe document. */
export interface RecipeDocumentV2 {
  schema_version: number
  variables?: RecipeVariable[]
  browser_defaults?: RecipeBrowserDefaults
  actions: RecipeAction[]
  edges?: RecipeEdge[]
  completion: RecipeCompletion
  /** Producer-only payload (canvas layout). Executors ignore it. */
  ui_metadata?: Record<string, unknown>
}
