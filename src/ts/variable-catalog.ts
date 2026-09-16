/**
 * Where a recipe variable's value comes from, and what the platform does with it.
 *
 * ## Why the schema's pattern is not enough
 *
 * `variableSource` in the JSON Schema bounds the NAMESPACE and nothing else:
 * `^(user\.fiscal\.[a-z][a-z0-9_]*|user\.[a-z][a-z0-9_]*|ticket\.extracted\.[a-z][a-z0-9_]*)$`.
 * Measured against the reference validator, `user.fiscal.rfk` and `user.nombre` are both **valid
 * documents**. They publish, reach a worker, resolve to nothing, and fail the ticket with
 * `variable_missing` — for a typo that three validation layers looked at and accepted.
 *
 * The parts of the source that are genuinely closed therefore belong in the contract next to the
 * namespaces, and this module is those parts. It answers, once, what the Modeler asks at authoring
 * time and the Generator asks at execution time:
 *
 * - which user values exist, and which of them may be bound at all
 * - what the platform will do to a value read off a ticket
 *
 * ## The two halves are closed differently, on purpose
 *
 * **{@link USER_FIELDS} is a closed set.** Its leaves are columns the API owns; a source outside
 * the set cannot resolve, so offering it or accepting it is a defect either way.
 *
 * **{@link TICKET_VALUE_KINDS} closes the vocabulary, not the membership.** A recipe may ask the
 * model for any field a portal needs — closing that would mean refusing a value the platform can
 * perfectly well extract. What is closed is which leaf names carry a normalizer, and that matters
 * more than it looks: the leaf of `ticket.extracted.<leaf>` is *both* the JSON key the vision model
 * is asked to return *and* the selector of the normalizer applied to the answer. `total` becomes
 * `1234.50`; `total_venta` is passed through as the model wrote it, `$ 1,234.50`, straight into the
 * portal's amount field. Two leaf names for the same concept are not synonyms here — one works and
 * one quietly does not.
 *
 * ## How the mirrors stay in step
 *
 * `schemas/variable-catalog.v1.json` is the artefact; this module and `VariableCatalog.cs` are both
 * mirrors of it. `scripts/verify-contract-parity.mjs` compares this module against the file entry
 * for entry and in order, and each consumer holds its own coverage test against the same artefact
 * — the Generator that it resolves every bindable field and normalizes every catalogued leaf, the
 * Modeler that it offers every bindable field and steers authors onto the catalogued leaves.
 *
 * @module
 */

// ── user fields ───────────────────────────────────────────────────────────────────────────────

/**
 * Whether a recipe may bind a stored user value.
 *
 * `bindable` — the Generator resolves it, so a variable may declare it as its source.
 *
 * `stored_only` — the platform holds the value but no recipe can act on it. This is not an
 * oversight to be fixed by adding it to the resolver: a variable is only ever rendered into the
 * `value` of a `fill`/`select` or the `url` of a `goto`, and the three boolean fiscal flags have no
 * text form a Mexican portal accepts. `check` and `uncheck` take no value, and the condition types
 * (`element_exists`, `element_absent`, `url_matches`) read the page rather than a variable, so
 * there is no verb through which a yes/no could act. Making these bindable needs a contract
 * addition — a condition that reads a variable — not a catalogue edit.
 *
 * They are catalogued anyway, and this is the point of the field: an author auditing which of their
 * profile data a recipe covers must be able to see that these exist and why they are not on offer.
 * A silent omission looks like a complete list.
 */
export type UserFieldSupport = 'bindable' | 'stored_only'

/**
 * Whether the platform can promise the field has a value.
 *
 * `always` — every write path validates it as non-empty, so a completed fiscal profile has it. A
 * required variable bound to one of these cannot fail resolution for want of a value.
 *
 * `optional` — the platform accepts a profile without it. That covers the nullable columns and also
 * two that are `NOT NULL` and still reachable as an empty string: `user.email` and `user.name` come
 * from the identity provider through a helper whose documented contract is "a value that fits,
 * possibly empty". A required variable bound to an `optional` field will fail some users' tickets,
 * which is sometimes exactly right — the portal refuses the invoice without it — and sometimes a
 * recipe defect. The Modeler says which it is at the moment of binding, so the choice is made
 * knowingly rather than discovered in the review queue.
 */
export type UserFieldAvailability = 'always' | 'optional'

/** One value the platform stores about the account holder. */
export interface UserFieldDefinition {
  /** The canonical `source` a recipe variable declares, e.g. `user.fiscal.rfc`. */
  readonly source: string
  readonly support: UserFieldSupport
  readonly availability: UserFieldAvailability
}

/**
 * Every value the platform stores about the account holder, in the order the artefact lists them.
 *
 * The order is part of the mirror: parity is compared positionally, so an entry moved in one half
 * and not the other is a failure rather than a silent difference in enumeration order.
 */
export const USER_FIELDS: readonly UserFieldDefinition[] = [
  { source: 'user.email', support: 'bindable', availability: 'optional' },
  { source: 'user.name', support: 'bindable', availability: 'optional' },
  { source: 'user.fiscal.rfc', support: 'bindable', availability: 'always' },
  { source: 'user.fiscal.legal_name', support: 'bindable', availability: 'always' },
  { source: 'user.fiscal.tax_regime', support: 'bindable', availability: 'always' },
  { source: 'user.fiscal.email', support: 'bindable', availability: 'optional' },
  { source: 'user.fiscal.postal_code', support: 'bindable', availability: 'always' },
  { source: 'user.fiscal.street', support: 'bindable', availability: 'optional' },
  { source: 'user.fiscal.exterior_number', support: 'bindable', availability: 'optional' },
  { source: 'user.fiscal.interior_number', support: 'bindable', availability: 'optional' },
  { source: 'user.fiscal.neighborhood', support: 'bindable', availability: 'optional' },
  { source: 'user.fiscal.municipality', support: 'bindable', availability: 'optional' },
  { source: 'user.fiscal.state', support: 'bindable', availability: 'optional' },
  { source: 'user.fiscal.reference', support: 'bindable', availability: 'optional' },
  { source: 'user.fiscal.country', support: 'bindable', availability: 'always' },
  { source: 'user.fiscal.is_foreign', support: 'stored_only', availability: 'always' },
  {
    source: 'user.fiscal.is_politically_exposed',
    support: 'stored_only',
    availability: 'always'
  },
  { source: 'user.fiscal.declares_ieps', support: 'stored_only', availability: 'always' }
] as const

/** The inventory keyed by source, for an O(1) lookup. */
const USER_FIELD_BY_SOURCE: ReadonlyMap<string, UserFieldDefinition> = new Map(
  USER_FIELDS.map((field) => [field.source, field])
)

/** The sources a recipe variable may declare, in catalogue order. */
export const BINDABLE_USER_FIELD_SOURCES: readonly string[] = USER_FIELDS.filter(
  (field) => field.support === 'bindable'
).map((field) => field.source)

/**
 * The definition behind a user source, or `null` when the platform stores no such value.
 *
 * Complexity: O(1).
 *
 * @param source - A variable's declared source.
 */
export function findUserField(source: string | null | undefined): UserFieldDefinition | null {
  if (source === null || source === undefined) return null
  return USER_FIELD_BY_SOURCE.get(source) ?? null
}

/**
 * Whether a source names a user value a recipe may bind.
 *
 * Narrower than the schema's prefix pattern on purpose: the pattern answers "could this be a user
 * field", this answers "is it one the Generator will resolve". A `user.*` source that fails here is
 * either a typo or a `stored_only` field, and both are worth saying before the recipe ships.
 *
 * Complexity: O(1).
 *
 * @param source - A variable's declared source.
 */
export function isBindableUserField(source: string | null | undefined): boolean {
  return findUserField(source)?.support === 'bindable'
}

// ── ticket fields ─────────────────────────────────────────────────────────────────────────────

/** What the platform does to a value the vision model read off the ticket. */
export type TicketValueKind = 'text' | 'tax_id' | 'postal_code' | 'amount' | 'date'

/** The leaf names that select one normalizer. */
export interface TicketValueKindDefinition {
  readonly kind: Exclude<TicketValueKind, 'text'>
  /** Leaf names that map to {@link kind}, in artefact order. */
  readonly leaves: readonly string[]
}

/**
 * The normalizer applied when a leaf matches no catalogued name.
 *
 * Whitespace is collapsed and nothing else. It is the only transformation that is safe on a value
 * whose meaning is unknown — and it is also why a mis-named amount reaches a portal with its
 * currency symbol still attached.
 */
export const TICKET_DEFAULT_VALUE_KIND: TicketValueKind = 'text'

/** Leaf names that carry a normalizer, in artefact order. */
export const TICKET_VALUE_KINDS: readonly TicketValueKindDefinition[] = [
  { kind: 'tax_id', leaves: ['rfc', 'tax_id', 'taxid'] },
  { kind: 'postal_code', leaves: ['postal_code', 'codigo_postal', 'cp', 'zip'] },
  {
    kind: 'amount',
    leaves: ['total', 'amount', 'importe', 'monto', 'subtotal', 'iva', 'impuesto']
  },
  { kind: 'date', leaves: ['date', 'fecha', 'issue_date', 'fecha_emision', 'ticket_date'] }
] as const

/** Leaf name to value kind, for an O(1) lookup. */
const TICKET_KIND_BY_LEAF: ReadonlyMap<string, TicketValueKind> = new Map(
  TICKET_VALUE_KINDS.flatMap((entry) =>
    entry.leaves.map((leaf) => [leaf, entry.kind as TicketValueKind] as const)
  )
)

/**
 * The last dot-separated segment of a canonical source.
 *
 * @param source - A variable's declared source, e.g. `ticket.extracted.total`.
 * @returns The leaf, or the whole string when it carries no dot.
 */
export function leafOfSource(source: string): string {
  const lastDot = source.lastIndexOf('.')
  return lastDot >= 0 && lastDot < source.length - 1 ? source.slice(lastDot + 1) : source
}

/**
 * What the platform will do to the value read for a ticket source.
 *
 * Complexity: O(1).
 *
 * @param source - A `ticket.extracted.*` source, or its bare leaf.
 * @returns The normalizer that will be applied, {@link TICKET_DEFAULT_VALUE_KIND} when the leaf
 * carries none.
 */
export function ticketValueKindOf(source: string | null | undefined): TicketValueKind {
  if (source === null || source === undefined) return TICKET_DEFAULT_VALUE_KIND
  return TICKET_KIND_BY_LEAF.get(leafOfSource(source)) ?? TICKET_DEFAULT_VALUE_KIND
}

// ── artefact identity ─────────────────────────────────────────────────────────────────────────

/** File name of the artefact both mirrors reproduce. */
export const VARIABLE_CATALOG_FILE_NAME = 'variable-catalog.v1.json'

/** Version of the catalogue this module mirrors. */
export const VARIABLE_CATALOG_VERSION = 1
