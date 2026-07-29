/**
 * Reference implementation of the v2 recipe contract, in TypeScript.
 *
 * Behavioural mirror of `Facturatix.Contracts.Recipes.RecipeSchemaV2Validator`. The Modeler runs
 * this one before publishing so an author sees the same verdict the API will produce, instead of
 * discovering the rejection after a round trip. The shared fixture corpus asserts that both
 * implementations reach the same verdict on the same document — that assertion is the only reason
 * "the Modeler validated it" means anything.
 *
 * Fail-closed everywhere: an unknown verb, an unknown condition type, an unexpected property are
 * all rejections, never values that get silently dropped.
 *
 * @module
 */

import {
  ALL_ACTIONS,
  ALL_ASSERTION_TYPES,
  ALL_COMPLETION_MODES,
  ALL_CONDITION_TYPES,
  ALL_DELIVERY_MODES,
  ALL_EDGE_BRANCHES,
  ALL_LOCATOR_STRATEGIES,
  ALL_ROOT_PROPERTIES,
  ACTIONS,
  ASSERTION_TYPES,
  CONDITION_TYPES,
  DEFAULT_EDGE_BRANCH,
  DELIVERY_MODES,
  EDGE_BRANCHES,
  LOCATOR_STRATEGIES,
  ROOT_PROPERTIES,
  SCHEMA_VERSION,
  VALIDATION_CODES as CODES
} from './recipe-schema-v2.js'

/** A single reason a recipe document was rejected. */
export interface RecipeValidationIssue {
  /** Stable machine-readable identifier of the rule that failed. */
  code: string
  /** Location inside the document, e.g. `actions[3].locator`. */
  path: string
  /** Human-readable explanation. Not part of the contract — never parse it. */
  message: string
}

/** Verdict of validating a recipe document against the v2 contract. */
export interface RecipeValidationResult {
  /** True when the document can be published and executed. */
  isValid: boolean
  /** Every rule that failed, in document order. */
  issues: RecipeValidationIssue[]
  /** Distinct issue codes, ordered — the form the fixture manifest compares against. */
  codes: string[]
  /** Issue descriptions for display; empty when the document is valid. */
  messages: string[]
}

const VARIABLE_NAME_PATTERN = /^[a-z][a-z0-9_]*$/
const VARIABLE_SOURCE_PATTERN =
  /^(user\.fiscal\.[a-z][a-z0-9_]*|user\.[a-z][a-z0-9_]*|ticket\.extracted\.[a-z][a-z0-9_]*)$/
const PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g

const COMMON_ACTION_PROPERTIES = [
  'id',
  'action',
  'description',
  'optional',
  'timeout_ms',
  'continue_on_error',
  'retry_count',
  'retry_delay_ms',
  'condition'
]

/** Declared variable names and the sources they resolve from. */
interface VariableCatalog {
  names: Set<string>
  sources: Set<string>
}

/** An action as the graph checks need to see it. */
interface ActionNode {
  id: string
  isConditional: boolean
  isOptional: boolean
}

/**
 * Validates a recipe document against the v2 contract.
 *
 * @param json - Raw contents of `InvoiceRecipeVersions.Steps`.
 * @returns A verdict listing every rule that failed, in document order.
 */
export function validateRecipeDocument(json: string): RecipeValidationResult {
  const issues: RecipeValidationIssue[] = []

  if (!json || json.trim().length === 0) {
    issues.push(issue(CODES.INVALID_JSON, '', 'The recipe document is empty.'))
    return toResult(issues)
  }

  let root: unknown
  try {
    root = JSON.parse(json)
  } catch (err) {
    issues.push(issue(CODES.INVALID_JSON, '', (err as Error).message))
    return toResult(issues)
  }

  return validateRecipeValue(root)
}

/**
 * Validates an in-memory document. Used by the Modeler, which builds the payload rather than
 * receiving it and would otherwise stringify just to parse it again.
 *
 * @param root - The document as a plain object.
 * @returns A verdict listing every rule that failed, in document order.
 */
export function validateRecipeValue(root: unknown): RecipeValidationResult {
  const issues: RecipeValidationIssue[] = []

  if (!isPlainObject(root)) {
    issues.push(
      issue(
        CODES.ROOT_NOT_OBJECT,
        '',
        `The recipe document must be a JSON object, but was ${describeKind(root)}.`
      )
    )
    return toResult(issues)
  }

  rejectUnknownProperties(root, ALL_ROOT_PROPERTIES, '', issues)
  validateSchemaVersion(root, issues)

  const variables = validateVariables(root, issues)
  const actions = validateActions(root, variables, issues)

  validateEdgesAndGraph(root, actions, issues)
  validateCompletion(root, variables, issues)

  return toResult(issues)
}

// ── schema_version ────────────────────────────────────────────────────────────────────────────

function validateSchemaVersion(
  root: Record<string, unknown>,
  issues: RecipeValidationIssue[]
): void {
  const key = ROOT_PROPERTIES.SCHEMA_VERSION
  if (!(key in root)) {
    issues.push(
      issue(CODES.SCHEMA_VERSION_MISSING, key, 'The document does not declare schema_version.')
    )
    return
  }

  if (root[key] !== SCHEMA_VERSION) {
    issues.push(
      issue(
        CODES.SCHEMA_VERSION_UNSUPPORTED,
        key,
        `Only schema_version ${SCHEMA_VERSION} is supported by this contract.`
      )
    )
  }
}

// ── variables ─────────────────────────────────────────────────────────────────────────────────

function validateVariables(
  root: Record<string, unknown>,
  issues: RecipeValidationIssue[]
): VariableCatalog {
  const catalog: VariableCatalog = { names: new Set(), sources: new Set() }
  const declared = root[ROOT_PROPERTIES.VARIABLES]

  if (declared === undefined) return catalog

  if (!Array.isArray(declared)) {
    issues.push(
      issue(CODES.VARIABLE_INVALID, ROOT_PROPERTIES.VARIABLES, 'variables must be an array.')
    )
    return catalog
  }

  declared.forEach((entry, index) => {
    const path = `variables[${index}]`

    if (!isPlainObject(entry)) {
      issues.push(issue(CODES.VARIABLE_INVALID, path, 'Each variable must be an object.'))
      return
    }

    rejectUnknownProperties(
      entry,
      ['name', 'source', 'required', 'pattern', 'description'],
      path,
      issues
    )

    const name = readString(entry, 'name')
    if (name === null || !VARIABLE_NAME_PATTERN.test(name)) {
      issues.push(
        issue(
          CODES.VARIABLE_INVALID,
          `${path}.name`,
          'A variable name must match ^[a-z][a-z0-9_]*$.'
        )
      )
    } else if (catalog.names.has(name)) {
      issues.push(
        issue(
          CODES.VARIABLE_NAME_DUPLICATE,
          `${path}.name`,
          `Variable '${name}' is declared more than once.`
        )
      )
    } else {
      catalog.names.add(name)
    }

    const source = readString(entry, 'source')
    if (source === null || !VARIABLE_SOURCE_PATTERN.test(source)) {
      issues.push(
        issue(
          CODES.VARIABLE_SOURCE_UNKNOWN,
          `${path}.source`,
          'A variable source must be under user.*, user.fiscal.* or ticket.extracted.*.'
        )
      )
    } else {
      catalog.sources.add(source)
    }

    if ('required' in entry && typeof entry.required !== 'boolean') {
      issues.push(issue(CODES.VARIABLE_INVALID, `${path}.required`, 'required must be a boolean.'))
    }

    if ('pattern' in entry && (typeof entry.pattern !== 'string' || entry.pattern.length === 0)) {
      issues.push(
        issue(CODES.VARIABLE_INVALID, `${path}.pattern`, 'pattern must be a non-empty string.')
      )
    }
  })

  return catalog
}

// ── actions ───────────────────────────────────────────────────────────────────────────────────

function validateActions(
  root: Record<string, unknown>,
  variables: VariableCatalog,
  issues: RecipeValidationIssue[]
): ActionNode[] {
  const nodes: ActionNode[] = []
  const declared = root[ROOT_PROPERTIES.ACTIONS]

  if (declared === undefined) {
    issues.push(
      issue(
        CODES.ACTIONS_MISSING,
        ROOT_PROPERTIES.ACTIONS,
        'The document does not declare an actions array.'
      )
    )
    return nodes
  }

  if (!Array.isArray(declared)) {
    issues.push(issue(CODES.ACTIONS_MISSING, ROOT_PROPERTIES.ACTIONS, 'actions must be an array.'))
    return nodes
  }

  if (declared.length === 0) {
    issues.push(
      issue(CODES.ACTIONS_EMPTY, ROOT_PROPERTIES.ACTIONS, 'A recipe needs at least one action.')
    )
    return nodes
  }

  const seenIds = new Set<string>()

  declared.forEach((entry, index) => {
    const path = `actions[${index}]`

    if (!isPlainObject(entry)) {
      issues.push(issue(CODES.ACTION_FIELD_INVALID, path, 'Each action must be an object.'))
      return
    }

    const id = readString(entry, 'id')
    if (id === null || id.length === 0) {
      issues.push(
        issue(
          CODES.ACTION_ID_MISSING,
          `${path}.id`,
          'Every action needs a non-empty id; edges address actions by it.'
        )
      )
    } else if (seenIds.has(id)) {
      issues.push(
        issue(CODES.ACTION_ID_DUPLICATE, `${path}.id`, `Action id '${id}' is used more than once.`)
      )
    } else {
      seenIds.add(id)
    }

    // The node is registered before the verb is checked so that an unrecognised verb reports only
    // itself. Skipping registration would make every edge touching the action look dangling,
    // burying the one issue the author has to fix under derived noise.
    const isConditional = validateCondition(entry, path, issues)
    const isOptional = entry.optional === true

    if (id !== null && id.length > 0) {
      nodes.push({ id, isConditional, isOptional })
    }

    const verb = readString(entry, 'action')
    if (verb === null || !ALL_ACTIONS.includes(verb)) {
      issues.push(
        issue(
          CODES.ACTION_TYPE_UNKNOWN,
          `${path}.action`,
          `'${verb ?? '<missing>'}' is not in the v2 action allowlist (${ALL_ACTIONS.join(', ')}).`
        )
      )
      return
    }

    rejectUnknownProperties(
      entry,
      [...COMMON_ACTION_PROPERTIES, ...verbProperties(verb)],
      path,
      issues
    )
    validateCommonActionFields(entry, path, issues)
    validateVerbFields(entry, verb, path, variables, issues)
  })

  return nodes
}

function verbProperties(verb: string): string[] {
  switch (verb) {
    case ACTIONS.GOTO:
      return ['url']
    case ACTIONS.FILL:
    case ACTIONS.SELECT:
      return ['locator', 'value']
    case ACTIONS.PRESS:
      return ['locator', 'key']
    case ACTIONS.WAIT:
      return ['duration_ms']
    default:
      return ['locator']
  }
}

function validateCommonActionFields(
  action: Record<string, unknown>,
  path: string,
  issues: RecipeValidationIssue[]
): void {
  requireIntegerIfPresent(action, 'timeout_ms', path, 100, 300000, issues)
  requireIntegerIfPresent(action, 'retry_count', path, 0, 5, issues)
  requireIntegerIfPresent(action, 'retry_delay_ms', path, 0, 60000, issues)

  if ('continue_on_error' in action && typeof action.continue_on_error !== 'boolean') {
    issues.push(
      issue(
        CODES.ACTION_FIELD_INVALID,
        `${path}.continue_on_error`,
        'continue_on_error must be a boolean.'
      )
    )
  }

  if ('optional' in action && typeof action.optional !== 'boolean') {
    issues.push(
      issue(CODES.ACTION_FIELD_INVALID, `${path}.optional`, 'optional must be a boolean.')
    )
  }
}

function validateVerbFields(
  action: Record<string, unknown>,
  verb: string,
  path: string,
  variables: VariableCatalog,
  issues: RecipeValidationIssue[]
): void {
  switch (verb) {
    case ACTIONS.GOTO:
      requireTemplateString(action, 'url', path, variables, issues)
      break

    case ACTIONS.FILL:
    case ACTIONS.SELECT: {
      requireLocator(action, path, issues)
      const value = action.value
      if (typeof value !== 'string') {
        issues.push(
          issue(CODES.ACTION_FIELD_MISSING, `${path}.value`, `'${verb}' requires a string value.`)
        )
      } else {
        validatePlaceholders(value, `${path}.value`, variables, issues)
      }
      break
    }

    case ACTIONS.PRESS: {
      requireLocator(action, path, issues)
      const key = readString(action, 'key')
      if (key === null || key.length === 0) {
        issues.push(
          issue(
            CODES.ACTION_FIELD_MISSING,
            `${path}.key`,
            "'press' requires 'key'; it is the only accepted name for the keyboard key."
          )
        )
      }
      break
    }

    case ACTIONS.WAIT: {
      const duration = action.duration_ms
      if (!isInteger(duration) || duration < 1 || duration > 120000) {
        issues.push(
          issue(
            CODES.ACTION_FIELD_MISSING,
            `${path}.duration_ms`,
            "'wait' requires duration_ms between 1 and 120000; timeout_ms is a different field."
          )
        )
      }
      break
    }

    default:
      requireLocator(action, path, issues)
      break
  }
}

function requireTemplateString(
  action: Record<string, unknown>,
  property: string,
  path: string,
  variables: VariableCatalog,
  issues: RecipeValidationIssue[]
): void {
  const value = readString(action, property)
  if (value === null || value.length === 0) {
    issues.push(
      issue(
        CODES.ACTION_FIELD_MISSING,
        `${path}.${property}`,
        `'${property}' is required and must be a non-empty string.`
      )
    )
    return
  }

  validatePlaceholders(value, `${path}.${property}`, variables, issues)
}

function validatePlaceholders(
  text: string,
  path: string,
  variables: VariableCatalog,
  issues: RecipeValidationIssue[]
): void {
  if (!text) return

  // The regex is module-level and /g, so its lastIndex has to be reset before each scan.
  PLACEHOLDER_PATTERN.lastIndex = 0
  let match = PLACEHOLDER_PATTERN.exec(text)
  while (match !== null) {
    const name = match[1]
    if (!variables.names.has(name)) {
      issues.push(
        issue(
          CODES.VARIABLE_REFERENCE_UNKNOWN,
          path,
          `'{{${name}}}' does not match any declared variable.`
        )
      )
    }
    match = PLACEHOLDER_PATTERN.exec(text)
  }
}

// ── locator ───────────────────────────────────────────────────────────────────────────────────

function requireLocator(
  owner: Record<string, unknown>,
  path: string,
  issues: RecipeValidationIssue[]
): void {
  if (!('locator' in owner)) {
    issues.push(
      issue(
        CODES.LOCATOR_MISSING,
        `${path}.locator`,
        'A structured locator is required; Playwright source strings are not accepted.'
      )
    )
    return
  }

  validateLocator(owner.locator, `${path}.locator`, issues)
}

function validateLocator(locator: unknown, path: string, issues: RecipeValidationIssue[]): void {
  if (!isPlainObject(locator)) {
    issues.push(issue(CODES.LOCATOR_MISSING, path, 'A locator must be an object.'))
    return
  }

  const strategy = readString(locator, 'strategy')
  if (strategy === null || !ALL_LOCATOR_STRATEGIES.includes(strategy)) {
    issues.push(
      issue(
        CODES.LOCATOR_STRATEGY_UNKNOWN,
        `${path}.strategy`,
        `'${strategy ?? '<missing>'}' is not a known locator strategy (${ALL_LOCATOR_STRATEGIES.join(', ')}).`
      )
    )
    return
  }

  if (strategy === LOCATOR_STRATEGIES.ROLE) {
    rejectUnknownProperties(locator, ['strategy', 'role', 'name', 'exact'], path, issues)

    const role = readString(locator, 'role')
    if (role === null || role.length === 0) {
      issues.push(
        issue(CODES.LOCATOR_FIELD_MISSING, `${path}.role`, 'A role locator requires the ARIA role.')
      )
    }
    return
  }

  rejectUnknownProperties(locator, ['strategy', 'value', 'exact'], path, issues)

  const value = readString(locator, 'value')
  if (value === null || value.length === 0) {
    issues.push(
      issue(
        CODES.LOCATOR_FIELD_MISSING,
        `${path}.value`,
        `A '${strategy}' locator requires a non-empty value.`
      )
    )
  }
}

// ── condition ─────────────────────────────────────────────────────────────────────────────────

/** @returns True when the action declares a condition, whether or not it validated. */
function validateCondition(
  action: Record<string, unknown>,
  path: string,
  issues: RecipeValidationIssue[]
): boolean {
  if (!('condition' in action)) return false

  const conditionPath = `${path}.condition`
  const condition = action.condition

  if (!isPlainObject(condition)) {
    issues.push(
      issue(CODES.CONDITION_TYPE_UNKNOWN, conditionPath, 'A condition must be an object.')
    )
    return true
  }

  const type = readString(condition, 'type')
  if (type === null || !ALL_CONDITION_TYPES.includes(type)) {
    // Fail-closed: an unrecognised gate is rejected here so it can never be silently treated as
    // "always run" at execution time.
    issues.push(
      issue(
        CODES.CONDITION_TYPE_UNKNOWN,
        `${conditionPath}.type`,
        `'${type ?? '<missing>'}' is not a known condition type (${ALL_CONDITION_TYPES.join(', ')}).`
      )
    )
    return true
  }

  if (type === CONDITION_TYPES.URL_MATCHES) {
    rejectUnknownProperties(
      condition,
      ['type', 'pattern', 'check_timeout_ms'],
      conditionPath,
      issues
    )

    const pattern = readString(condition, 'pattern')
    if (pattern === null || pattern.length === 0) {
      issues.push(
        issue(
          CODES.CONDITION_FIELD_MISSING,
          `${conditionPath}.pattern`,
          'A url_matches condition requires a non-empty pattern.'
        )
      )
    }
  } else {
    rejectUnknownProperties(
      condition,
      ['type', 'locator', 'check_timeout_ms'],
      conditionPath,
      issues
    )

    if (!('locator' in condition)) {
      issues.push(
        issue(
          CODES.CONDITION_FIELD_MISSING,
          `${conditionPath}.locator`,
          `A '${type}' condition requires a locator.`
        )
      )
    } else {
      validateLocator(condition.locator, `${conditionPath}.locator`, issues)
    }
  }

  requireIntegerIfPresent(condition, 'check_timeout_ms', conditionPath, 0, 120000, issues)
  return true
}

// ── edges and graph ───────────────────────────────────────────────────────────────────────────

function validateEdgesAndGraph(
  root: Record<string, unknown>,
  actions: ActionNode[],
  issues: RecipeValidationIssue[]
): void {
  if (actions.length === 0) return

  const byId = new Map<string, ActionNode>()
  for (const node of actions) byId.set(node.id, node)

  const adjacency = new Map<string, string[]>()
  const hasIncoming = new Set<string>()
  let edgeCount = 0

  const declared = root[ROOT_PROPERTIES.EDGES]
  if (declared !== undefined) {
    if (!Array.isArray(declared)) {
      issues.push(
        issue(CODES.EDGE_ENDPOINT_UNKNOWN, ROOT_PROPERTIES.EDGES, 'edges must be an array.')
      )
      return
    }

    declared.forEach((entry, index) => {
      const path = `edges[${index}]`
      edgeCount++

      if (!isPlainObject(entry)) {
        issues.push(issue(CODES.EDGE_ENDPOINT_UNKNOWN, path, 'Each edge must be an object.'))
        return
      }

      rejectUnknownProperties(entry, ['from', 'to', 'branch'], path, issues)

      const from = readString(entry, 'from')
      const to = readString(entry, 'to')

      if (from === null || !byId.has(from)) {
        issues.push(
          issue(
            CODES.EDGE_ENDPOINT_UNKNOWN,
            `${path}.from`,
            `Edge source '${from ?? '<missing>'}' is not a declared action id.`
          )
        )
      }

      if (to === null || !byId.has(to)) {
        issues.push(
          issue(
            CODES.EDGE_ENDPOINT_UNKNOWN,
            `${path}.to`,
            `Edge target '${to ?? '<missing>'}' is not a declared action id.`
          )
        )
      }

      const branch = 'branch' in entry ? readString(entry, 'branch') : DEFAULT_EDGE_BRANCH
      if (branch === null || !ALL_EDGE_BRANCHES.includes(branch)) {
        issues.push(
          issue(
            CODES.EDGE_BRANCH_UNKNOWN,
            `${path}.branch`,
            `'${branch ?? '<invalid>'}' is not a known branch (${ALL_EDGE_BRANCHES.join(', ')}).`
          )
        )
        return
      }

      if (from === null || to === null) return
      const source = byId.get(from)
      if (source === undefined || !byId.has(to)) return

      const isBranchExit = branch !== EDGE_BRANCHES.NEXT

      if (isBranchExit && !source.isConditional) {
        issues.push(
          issue(
            CODES.EDGE_BRANCH_WITHOUT_CONDITION,
            `${path}.branch`,
            `A '${branch}' edge may only leave an action that declares a condition.`
          )
        )
      } else if (!isBranchExit && source.isConditional) {
        issues.push(
          issue(
            CODES.EDGE_BRANCH_ON_CONDITIONAL,
            `${path}.branch`,
            "A conditional action must route through 'true'/'false' edges; 'next' would make the " +
              'outcome of the condition unobservable.'
          )
        )
      }

      hasIncoming.add(to)
      const targets = adjacency.get(from)
      if (targets === undefined) adjacency.set(from, [to])
      else targets.push(to)
    })
  }

  if (edgeCount === 0) {
    // No edges means strictly linear execution in array order: the first action is the root and
    // every action is reachable by construction.
    return
  }

  const roots = actions.filter((node) => !hasIncoming.has(node.id)).map((node) => node.id)

  if (roots.length === 0) {
    issues.push(
      issue(
        CODES.GRAPH_NO_ROOT,
        ROOT_PROPERTIES.EDGES,
        'Every action has an incoming edge, so the graph has no entry point.'
      )
    )
    return
  }

  if (roots.length > 1) {
    issues.push(
      issue(
        CODES.GRAPH_MULTIPLE_ROOTS,
        ROOT_PROPERTIES.EDGES,
        `The graph has ${roots.length} entry points (${roots.join(', ')}); exactly one is required.`
      )
    )
    return
  }

  const reachable = new Set<string>()
  if (hasCycle(roots[0], adjacency, reachable)) {
    issues.push(
      issue(CODES.GRAPH_CYCLE, ROOT_PROPERTIES.EDGES, 'The execution graph contains a cycle.')
    )
    return
  }

  for (const node of actions) {
    if (!node.isOptional && !reachable.has(node.id)) {
      issues.push(
        issue(
          CODES.GRAPH_ORPHAN_REQUIRED,
          'actions',
          `Action '${node.id}' is required but unreachable from the entry point.`
        )
      )
    }
  }
}

/**
 * Iterative depth-first walk that both detects cycles and collects the reachable set. Iterative
 * rather than recursive so a pathological recipe cannot overflow the stack.
 */
function hasCycle(root: string, adjacency: Map<string, string[]>, reachable: Set<string>): boolean {
  const onPath = new Set<string>()
  const stack: { node: string; next: number }[] = [{ node: root, next: 0 }]

  reachable.add(root)
  onPath.add(root)

  while (stack.length > 0) {
    const frame = stack.pop() as { node: string; next: number }
    const targets = adjacency.get(frame.node)

    if (targets === undefined || frame.next >= targets.length) {
      onPath.delete(frame.node)
      continue
    }

    stack.push({ node: frame.node, next: frame.next + 1 })

    const child = targets[frame.next]
    if (onPath.has(child)) return true

    if (!reachable.has(child)) {
      reachable.add(child)
      onPath.add(child)
      stack.push({ node: child, next: 0 })
    }
  }

  return false
}

// ── completion ────────────────────────────────────────────────────────────────────────────────

function validateCompletion(
  root: Record<string, unknown>,
  variables: VariableCatalog,
  issues: RecipeValidationIssue[]
): void {
  const key = ROOT_PROPERTIES.COMPLETION
  const completion = root[key]

  if (completion === undefined) {
    issues.push(
      issue(
        CODES.COMPLETION_MISSING,
        key,
        'A recipe without a completion block can never prove the portal finished.'
      )
    )
    return
  }

  if (!isPlainObject(completion)) {
    issues.push(issue(CODES.COMPLETION_MISSING, key, 'completion must be an object.'))
    return
  }

  rejectUnknownProperties(completion, ['mode', 'assertions', 'delivery'], key, issues)

  if ('mode' in completion) {
    const mode = readString(completion, 'mode')
    if (mode === null || !ALL_COMPLETION_MODES.includes(mode)) {
      issues.push(
        issue(
          CODES.COMPLETION_MODE_UNKNOWN,
          'completion.mode',
          `'${mode ?? '<invalid>'}' is not a known completion mode (${ALL_COMPLETION_MODES.join(', ')}).`
        )
      )
    }
  }

  validateAssertions(completion, issues)
  validateDelivery(completion, variables, issues)
}

function validateAssertions(
  completion: Record<string, unknown>,
  issues: RecipeValidationIssue[]
): void {
  const assertions = completion.assertions

  if (!Array.isArray(assertions) || assertions.length === 0) {
    issues.push(
      issue(
        CODES.ASSERTIONS_MISSING,
        'completion.assertions',
        'At least one terminal assertion is required; finishing the last step is not proof.'
      )
    )
    return
  }

  assertions.forEach((entry, index) => {
    const path = `completion.assertions[${index}]`

    if (!isPlainObject(entry)) {
      issues.push(issue(CODES.ASSERTION_TYPE_UNKNOWN, path, 'Each assertion must be an object.'))
      return
    }

    const type = readString(entry, 'type')
    if (type === null || !ALL_ASSERTION_TYPES.includes(type)) {
      issues.push(
        issue(
          CODES.ASSERTION_TYPE_UNKNOWN,
          `${path}.type`,
          `'${type ?? '<missing>'}' is not a known assertion type (${ALL_ASSERTION_TYPES.join(', ')}).`
        )
      )
      return
    }

    if (type === ASSERTION_TYPES.SELECTOR_TEXT) {
      rejectUnknownProperties(entry, ['type', 'locator', 'contains'], path, issues)

      if (!('locator' in entry)) {
        issues.push(
          issue(
            CODES.ASSERTION_FIELD_MISSING,
            `${path}.locator`,
            'A selector_text assertion requires a locator.'
          )
        )
      } else {
        validateLocator(entry.locator, `${path}.locator`, issues)
      }

      const contains = readString(entry, 'contains')
      if (contains === null || contains.length === 0) {
        issues.push(
          issue(
            CODES.ASSERTION_FIELD_MISSING,
            `${path}.contains`,
            'A selector_text assertion requires the text the portal must show.'
          )
        )
      }
      return
    }

    rejectUnknownProperties(entry, ['type', 'pattern'], path, issues)

    const pattern = readString(entry, 'pattern')
    if (pattern === null || pattern.length === 0) {
      issues.push(
        issue(
          CODES.ASSERTION_FIELD_MISSING,
          `${path}.pattern`,
          'A url_matches assertion requires a non-empty pattern.'
        )
      )
    }
  })
}

function validateDelivery(
  completion: Record<string, unknown>,
  variables: VariableCatalog,
  issues: RecipeValidationIssue[]
): void {
  if (!('delivery' in completion)) return

  const path = 'completion.delivery'
  const delivery = completion.delivery

  if (!isPlainObject(delivery)) {
    issues.push(issue(CODES.DELIVERY_MODE_UNKNOWN, path, 'delivery must be an object.'))
    return
  }

  const mode = readString(delivery, 'mode')
  if (mode === null || !ALL_DELIVERY_MODES.includes(mode)) {
    issues.push(
      issue(
        CODES.DELIVERY_MODE_UNKNOWN,
        `${path}.mode`,
        `'${mode ?? '<missing>'}' is not a known delivery mode (${ALL_DELIVERY_MODES.join(', ')}).`
      )
    )
    return
  }

  if (mode !== DELIVERY_MODES.PORTAL_EMAIL) {
    rejectUnknownProperties(delivery, ['mode'], path, issues)
    return
  }

  rejectUnknownProperties(delivery, ['mode', 'destination_binding'], path, issues)

  const binding = readString(delivery, 'destination_binding')
  if (binding === null || binding.length === 0) {
    issues.push(
      issue(
        CODES.DELIVERY_BINDING_MISSING,
        `${path}.destination_binding`,
        'portal_email delivery must state which address the portal was given.'
      )
    )
    return
  }

  if (!VARIABLE_SOURCE_PATTERN.test(binding)) {
    issues.push(
      issue(
        CODES.DELIVERY_BINDING_UNRESOLVABLE,
        `${path}.destination_binding`,
        `'${binding}' is not a canonical source.`
      )
    )
    return
  }

  if (!variables.sources.has(binding)) {
    // The binding has to be resolvable from data the recipe actually collects, otherwise the
    // evidence would name an address the run never used.
    issues.push(
      issue(
        CODES.DELIVERY_BINDING_UNRESOLVABLE,
        `${path}.destination_binding`,
        `No declared variable resolves '${binding}'.`
      )
    )
  }
}

// ── shared helpers ────────────────────────────────────────────────────────────────────────────

function rejectUnknownProperties(
  element: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: RecipeValidationIssue[]
): void {
  for (const name of Object.keys(element)) {
    if (allowed.includes(name)) continue
    issues.push(
      issue(
        CODES.UNKNOWN_PROPERTY,
        path.length === 0 ? name : `${path}.${name}`,
        `'${name}' is not part of the v2 contract.`
      )
    )
  }
}

function requireIntegerIfPresent(
  owner: Record<string, unknown>,
  property: string,
  path: string,
  min: number,
  max: number,
  issues: RecipeValidationIssue[]
): void {
  if (!(property in owner)) return

  const value = owner[property]
  if (!isInteger(value) || value < min || value > max) {
    issues.push(
      issue(
        CODES.ACTION_FIELD_INVALID,
        `${path}.${property}`,
        `${property} must be an integer between ${min} and ${max}.`
      )
    )
  }
}

function readString(owner: Record<string, unknown>, property: string): string | null {
  const value = owner[property]
  return typeof value === 'string' ? value : null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function describeKind(value: unknown): string {
  if (value === null) return 'Null'
  if (Array.isArray(value)) return 'Array'
  if (typeof value === 'string') return 'String'
  if (typeof value === 'number') return 'Number'
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  return typeof value
}

function issue(code: string, path: string, message: string): RecipeValidationIssue {
  return { code, path, message }
}

function toResult(issues: RecipeValidationIssue[]): RecipeValidationResult {
  return {
    isValid: issues.length === 0,
    issues,
    codes: [...new Set(issues.map((i) => i.code))].sort(),
    messages: issues.map((i) => (i.path.length === 0 ? i.message : `${i.path}: ${i.message}`))
  }
}
