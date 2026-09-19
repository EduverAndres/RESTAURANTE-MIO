// The seam where a gateway refund call will one day go. It is empty, and
// that is a decision rather than an omission.
//
// ---------------------------------------------------------------------------
// Why nothing calls Wompi here
// ---------------------------------------------------------------------------
// Three things would have to be true before this function could send money
// back through the provider, and none of them is established:
//
//   1. Wompi documents `POST /v1/refunds` under a heading labelled
//      "(Sandbox)". Whether the same endpoint exists, behaves identically, or
//      exists at all in production is NOT STATED in that documentation.
//   2. Voids (`/v1/transactions/{id}/void`) are documented for CARD
//      transactions only.
//   3. Whether PSE, Nequi and Bancolombia Transfer are refundable through the
//      API at all is unverified.
//
// Writing the call anyway would mean shipping code whose success path nobody
// has seen, on the one flow where being wrong means the customer's money is
// in neither party's hands. So this work unit records refunds as BOOKKEEPING
// ONLY: `public.refunds` says the merchant gave the money back, by whatever
// channel they actually used (cash, a transfer, the Wompi dashboard), and the
// order, the metrics and the payouts all follow from that record.
//
// ---------------------------------------------------------------------------
// What "slotting it in" will look like
// ---------------------------------------------------------------------------
// The caller (`recordOrderRefund` / `recordRefundAsAdmin`) already writes the
// bookkeeping row first and only then would call this. That order must not
// change: a gateway refund that succeeds and is never recorded is worse than
// a recorded refund the gateway has not processed yet. When the endpoint is
// confirmed, this function gains the HTTP call and returns
// `{ attempted: true, ... }`, the caller stores the provider's refund id
// alongside the row, and nothing else in the flow moves.
//
// Until then it resolves, does nothing, and says so.

export interface GatewayRefundRequest {
  /** `orders.payment_method` — today only `wompi` could ever be eligible. */
  provider: string
  /** The provider transaction id, when one is known. */
  transactionId?: string | null
  /** Amount in cents, the unit every gateway in this codebase speaks. */
  amountInCents?: number | null
}

export type GatewayRefundResult =
  | { attempted: false; reason: 'not_implemented' }
  | { attempted: true; ok: true; refundId: string }
  | { attempted: true; ok: false; error: string }

/**
 * No-op. See the file header: the provider's refund API is not confirmed for
 * production, so nothing is sent. Callers must treat `attempted: false` as
 * "the bookkeeping stands on its own", not as a failure.
 */
export async function refundThroughGateway(
  request: GatewayRefundRequest,
): Promise<GatewayRefundResult> {
  // The parameter is part of the contract, not decoration: it is what the
  // real call will send. Named rather than underscored so adding the request
  // is a one-line change instead of a signature change.
  void request
  return { attempted: false, reason: 'not_implemented' }
}
