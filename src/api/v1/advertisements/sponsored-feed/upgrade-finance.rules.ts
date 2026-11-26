export function fullApproval(
  status: string,
  revoked: unknown,
  requested: unknown,
  approved: unknown,
  amount: unknown
): boolean {
  const cents = (v: unknown) => (v == null ? NaN : Math.round(Number(v) * 100));
  const n = cents(amount);
  return (
    status === "APPROVED" &&
    revoked == null &&
    Number.isSafeInteger(n) &&
    n > 0 &&
    cents(requested) === n &&
    cents(approved) === n
  );
}
