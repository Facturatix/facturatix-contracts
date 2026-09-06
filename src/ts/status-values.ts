/**
 * Recipe version lifecycle constants.
 *
 * TypeScript mirror of `Facturatix.Contracts.Recipes.RecipeVersionStatusValues` — the strings
 * persisted in `InvoiceRecipeVersions.Status`, which the Modeler reads to render version history,
 * to tell the general version from the pilot version, and to decide which transitions a version
 * still admits.
 *
 * Ticket statuses are deliberately absent: no TypeScript consumer of this package branches on
 * them, and a mirror nobody uses is a mirror nothing keeps in sync. Ticket *rejection reasons* are
 * here — see `rejection-reasons.js` — because the Web App does branch on those.
 *
 * @module
 */

/**
 * Invoice recipe version lifecycle: draft → piloting → published → deprecated → archived.
 * An abandoned pilot returns to draft, never to deprecated.
 */
export const RECIPE_VERSION_STATUS = {
  DRAFT: 'draft',
  PILOTING: 'piloting',
  PUBLISHED: 'published',
  DEPRECATED: 'deprecated',
  ARCHIVED: 'archived'
} as const

/** A value of {@link RECIPE_VERSION_STATUS}. */
export type RecipeVersionStatus = (typeof RECIPE_VERSION_STATUS)[keyof typeof RECIPE_VERSION_STATUS]

/** Every lifecycle status, in transition order. */
export const ALL_RECIPE_VERSION_STATUSES: readonly string[] = [
  RECIPE_VERSION_STATUS.DRAFT,
  RECIPE_VERSION_STATUS.PILOTING,
  RECIPE_VERSION_STATUS.PUBLISHED,
  RECIPE_VERSION_STATUS.DEPRECATED,
  RECIPE_VERSION_STATUS.ARCHIVED
]
