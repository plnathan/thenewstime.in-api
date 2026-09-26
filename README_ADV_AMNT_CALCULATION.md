## Final Advertisement Amount Calculation

Step 1:
Advertisement Amount
\-
Discount Amount
\=
Net Advertisement Amount

Step2
Net Advertisement Amount
\-
Verified Payment Amount
\-
Adjustment Amount
\=
Due Amount

Step3
Due Amount = MAX(calculated value, 0)

Example:
Advertisement Amount ₹100,000
Discount % 10%
Discount Amount ₹10,000
────────────────────────────────────
Net Advertisement Amount ₹90,000

Verified Advance ₹30,000
Verified Regular Payment ₹40,000
────────────────────────────────────
Verified Paid ₹70,000

Adjustment Amount ₹20,000
────────────────────────────────────
Due Amount ₹0

---

## Automatic hold release

The financial settlement condition becomes:
Verified Paid +
Adjustment

> =
> Net Advertisement Amount

Then
Due Amount = 0

---

## Revenue Report

Revenue
Cash Received
Discount Given
Adjustments
Outstanding

---

## Financial Modal:

                         ADVERTISEMENT
                              │
                 ┌────────────┴────────────┐
                 │                         │
          Advertisement Amount       Discount %
                 │                         │
                 │                  Discount Amount
                 │                         │
                 └──────────┬──────────────┘
                            ↓
                    Net Advertisement
                         Amount
                            │
             ┌──────────────┼──────────────┐
             ↓              ↓              ↓
       Advance Required   Payments     Adjustment
                            │
                     ┌──────┴──────┐
                     ↓             ↓
                  ADVANCE        REGULAR
                     │             │
                     └──────┬──────┘
                            ↓
                     Verified Paid
                            │
                            ↓
                  Paid + Adjustment
                            │
                            ↓
                         Due Amount
                            │
                  ┌─────────┴─────────┐
                  ↓                   ↓
                Due > 0             Due = 0
                  │                   │
           Payment Attention      Settlement
                  │
            Client Alert
                  │
            Optional Hold

## Validations:

advertisementAmount >= 0

discountPercentage >= 0
discountPercentage <= 100

discountAmount = advertisementAmount × discountPercentage / 100

advancePercentage >= 0
advancePercentage <= 100

advanceAmount = advertisementAmount × advancePercentage / 100

advanceAmount <= advertisementAmount - discountAmount

-------------------
## Testing:
✓ advertisementAmount accepts valid amount
✓ advertisementAmount rejects negative amount

✓ discountPercentage defaults to 0
✓ discountPercentage accepts 0–100
✓ discountPercentage rejects < 0
✓ discountPercentage rejects > 100

✓ discountAmount is calculated automatically
✓ discountAmount rounds to 2 decimal places
✓ discountAmount cannot exceed advertisementAmount

✓ advancePercentage defaults to 0
✓ advancePercentage accepts 0–100
✓ advancePercentage rejects < 0
✓ advancePercentage rejects > 100

✓ advanceAmount is calculated automatically
✓ advanceAmount cannot exceed net advertisement amount

✓ existing advertisements continue loading
✓ existing advertisements return zero discount/advance
✓ create persists calculated financial fields
✓ update recalculates calculated financial fields

✓ adjustment fields are NOT writable through normal advertisement create/update

---------------------------------------

AD_CREATOR
    │
    │ creates financial request
    ▼
SUBMITTED
    │
    ├──────────────► HOLD
    │                  │
    │                  ▼
    │              AD_FINANCE_APPROVER
    │                  │
    │             ┌────┴────┐
    │             ▼         ▼
    │          APPROVED   REJECTED
    │             │
    │             ▼
    │       Payment Service
    │             │
    │             ▼
    │       REFUND / ADJUSTMENT

----------------------------------------
AD_CREATOR
    │
    ▼
DISCOUNT REQUEST
    │
    ▼
AD_FINANCE_APPROVER
    │
    ├── APPROVED ──► Advertisement financial values updated
    │
    ├── REJECTED
    │
    └── HOLD

-------------------------------        