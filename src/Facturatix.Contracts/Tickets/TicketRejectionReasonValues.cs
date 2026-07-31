namespace Facturatix.Contracts.Tickets;

/// <summary>
/// Canonical snake_case codes for why an administrator rejected a ticket during review.
/// These values are the single source of truth for database serialization and must match the
/// <c>TicketRejectionReason</c> enum defined in <c>facturatix-api</c>.
/// <para>
/// Unlike the status vocabularies, these are consumed directly rather than mirrored: the Web App
/// branches on them to choose the sentence the user reads, and a code it does not recognise has no
/// safe failure mode — the user is either shown a raw code or a message that is not about their
/// problem. The TypeScript half of this package carries the same list.
/// </para>
/// <para>
/// Adding a code is a breaking act for clients even though it is a PATCH here: every consumer needs
/// user-facing copy for it, in every locale, before an administrator can select it.
/// </para>
/// </summary>
public static class TicketRejectionReasonValues
{
    /// <summary>The image is not a purchase ticket at all.</summary>
    public const string NotATicket = "not_a_ticket";

    /// <summary>Part of the ticket is missing from the frame — cut off, folded, or cropped.</summary>
    public const string ImageIncomplete = "image_incomplete";

    /// <summary>The image is a ticket but too blurred to read reliably.</summary>
    public const string ImageTooBlurry = "image_too_blurry";

    /// <summary>
    /// The ticket is legible but does not print what invoicing requires, typically the merchant's
    /// tax id or the transaction reference the portal asks for.
    /// </summary>
    public const string TicketDataIncomplete = "ticket_data_incomplete";

    /// <summary>
    /// The merchant does not offer online invoicing, so no recipe can ever exist for it. Distinct
    /// from <see cref="MerchantNotRegistered"/>: this one never becomes supported.
    /// </summary>
    public const string MerchantHasNoPortal = "merchant_has_no_portal";

    /// <summary>
    /// The merchant invoices online but is not in the catalog yet. The ticket is valid and the
    /// answer may change once the merchant is certified.
    /// </summary>
    public const string MerchantNotRegistered = "merchant_not_registered";

    /// <summary>The same purchase was already submitted and invoiced.</summary>
    public const string DuplicateSubmission = "duplicate_submission";

    /// <summary>
    /// The invoicing window the merchant grants has closed, so its portal no longer accepts it.
    /// </summary>
    public const string InvoicingPeriodExpired = "invoicing_period_expired";

    /// <summary>
    /// Every published code. Consumers iterate this to assert they carry copy for all of them,
    /// which is what turns a missing translation into a failing build rather than a user reading
    /// the wrong explanation for their rejection.
    /// </summary>
    public static readonly IReadOnlyList<string> All =
    [
        NotATicket,
        ImageIncomplete,
        ImageTooBlurry,
        TicketDataIncomplete,
        MerchantHasNoPortal,
        MerchantNotRegistered,
        DuplicateSubmission,
        InvoicingPeriodExpired,
    ];
}
