/**
 * Why an administrator rejected a ticket during review.
 *
 * TypeScript mirror of `Facturatix.Contracts.Tickets.TicketRejectionReasonValues` — the codes
 * persisted in `Tickets.FailureReason` and returned to the owner of the ticket.
 *
 * Ticket *statuses* are deliberately absent from this package (see `status-values.ts`) because no
 * TypeScript consumer touches them. Rejection reasons are the exception: the Web App branches on
 * them to pick the sentence the user reads, so a divergence has no safe failure mode — the user is
 * shown either a raw code or an explanation that is not about their problem.
 *
 * The API stores a code rather than a sentence precisely so the wording lives in the client: every
 * user who hit the same problem then reads the same explanation, in their own language, instead of
 * whatever a reviewer happened to type.
 *
 * @module
 */

/** Codes an administrator may assign when rejecting a ticket. */
export const TICKET_REJECTION_REASON = {
  /** The image is not a purchase ticket at all. */
  NOT_A_TICKET: 'not_a_ticket',
  /** Part of the ticket is missing from the frame — cut off, folded, or cropped. */
  IMAGE_INCOMPLETE: 'image_incomplete',
  /** The image is a ticket but too blurred to read reliably. */
  IMAGE_TOO_BLURRY: 'image_too_blurry',
  /** Legible, but missing what invoicing needs — typically the merchant's tax id. */
  TICKET_DATA_INCOMPLETE: 'ticket_data_incomplete',
  /** The merchant does not invoice online, so it will never be supported. */
  MERCHANT_HAS_NO_PORTAL: 'merchant_has_no_portal',
  /** The merchant invoices online but is not in the catalog yet; this may change. */
  MERCHANT_NOT_REGISTERED: 'merchant_not_registered',
  /** The same purchase was already submitted and invoiced. */
  DUPLICATE_SUBMISSION: 'duplicate_submission',
  /** The window the merchant grants for invoicing has closed. */
  INVOICING_PERIOD_EXPIRED: 'invoicing_period_expired'
} as const

/** A rejection code, as stored and sent over the wire. */
export type TicketRejectionReason =
  (typeof TICKET_REJECTION_REASON)[keyof typeof TICKET_REJECTION_REASON]

/**
 * Every published code.
 *
 * Consumers iterate this to assert they carry copy for all of them, which is what turns a missing
 * translation into a failing build rather than a user reading the wrong explanation.
 */
export const ALL_TICKET_REJECTION_REASONS: readonly TicketRejectionReason[] = [
  TICKET_REJECTION_REASON.NOT_A_TICKET,
  TICKET_REJECTION_REASON.IMAGE_INCOMPLETE,
  TICKET_REJECTION_REASON.IMAGE_TOO_BLURRY,
  TICKET_REJECTION_REASON.TICKET_DATA_INCOMPLETE,
  TICKET_REJECTION_REASON.MERCHANT_HAS_NO_PORTAL,
  TICKET_REJECTION_REASON.MERCHANT_NOT_REGISTERED,
  TICKET_REJECTION_REASON.DUPLICATE_SUBMISSION,
  TICKET_REJECTION_REASON.INVOICING_PERIOD_EXPIRED
]
