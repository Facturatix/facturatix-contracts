/**
 * Recipe version lifecycle constants.
 *
 * TypeScript mirror of `Facturatix.Contracts.Recipes.RecipeVersionStatusValues` — the strings
 * persisted in `InvoiceRecipeVersions.Status`, which the Modeler reads to render version history
 * and to decide whether a version can still be published.
 *
 * Ticket statuses are deliberately absent: no TypeScript consumer of this package touches tickets,
 * and a mirror nobody uses is a mirror nothing keeps in sync.
 *
 * @module
 */

/** Invoice recipe version lifecycle: draft → published → deprecated → archived. */
export const RECIPE_VERSION_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  DEPRECATED: 'deprecated',
  ARCHIVED: 'archived'
} as const

/** Every lifecycle status, in transition order. */
export const ALL_RECIPE_VERSION_STATUSES: readonly string[] = [
  RECIPE_VERSION_STATUS.DRAFT,
  RECIPE_VERSION_STATUS.PUBLISHED,
  RECIPE_VERSION_STATUS.DEPRECATED,
  RECIPE_VERSION_STATUS.ARCHIVED
]
