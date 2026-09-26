## Folder structure:

advertisements/
│
├── advertisements/
│ ├── advertisement.controller.ts
│ ├── advertisement.service.ts
│ ├── advertisement.repository.ts
│ ├── advertisement.routes.ts
│ ├── advertisement.types.ts
│ ├── advertisement.validation.ts
│ └── tests/
│
├── placements/
│ ├── placement.controller.ts
│ ├── placement.service.ts
│ ├── placement.repository.ts
│ ├── placement.routes.ts
│ ├── placement.types.ts
│ ├── placement.validation.ts
│ └── tests/
│
├── placement-rules/
│ ├── placement-rule.controller.ts
│ ├── placement-rule.service.ts
│ ├── placement-rule.repository.ts
│ ├── placement-rule.routes.ts
│ ├── placement-rule.types.ts
│ ├── placement-rule.validation.ts
│ └── tests/
│
├── schedules/
│ ├── schedule.controller.ts
│ ├── schedule.service.ts
│ ├── schedule.repository.ts
│ ├── schedule.routes.ts
│ ├── schedule.types.ts
│ ├── schedule.validation.ts
│ └── tests/
│
├── targets/
│ ├── target.controller.ts
│ ├── target.service.ts
│ ├── target.repository.ts
│ ├── target.routes.ts
│ ├── target.types.ts
│ ├── target.validation.ts
│ └── tests/
│
├── creatives/
│ ├── creative.controller.ts
│ ├── creative.service.ts
│ ├── creative.repository.ts
│ ├── creative.routes.ts
│ ├── creative.types.ts
│ ├── creative.validation.ts
│ └── tests/
│
├── formats/
│ ├── format.controller.ts
│ ├── format.service.ts
│ ├── format.repository.ts
│ ├── format.routes.ts
│ ├── format.types.ts
│ ├── format.validation.ts
│ └── tests/
│
├── delivery/
│ ├── delivery.controller.ts
│ ├── delivery.service.ts
│ ├── delivery.repository.ts
│ ├── delivery.routes.ts
│ ├── delivery.types.ts
│ └── tests/
│
└── index.ts

## Admin workflow

Create Advertisement
↓
Draft
↓
Configure placement
↓
Configure scope
↓
Upload media
↓
Set priority
↓
Set schedule
↓
Activate
↓
Public website displays it

## Backend structure

src/api/v1/advertisements/
│
├── advertisement.controller.ts
├── advertisement.service.ts
├── advertisement.repository.ts
├── advertisement.routes.ts
├── advertisement.schema.ts
├── advertisement.types.ts
├── advertisement.mapper.ts
└── tests/
├── advertisement.repository.test.ts
├── advertisement.service.test.ts
├── advertisement.controller.test.ts
└── advertisements.integration.test.ts

## Advertisement Management

Advertisement
│
├── Placement / Slot
│ └── Where?
│
├── Format
│ └── What type?
│
├── Targeting
│ └── Who/where?
│
├── Schedule
│ └── When?
│
├── Priority
│ └── Which ad wins?
│
├── Media / Creative
│ └── What is displayed?
│
└── Status
└── Can it display?

## Ad Format

| Code                  | Format               | Typical Size |
| --------------------- | -------------------- | ------------ |
| `LEADERBOARD`         | Leaderboard          | 728×90       |
| `MOBILE_BANNER`       | Mobile Banner        | 320×50       |
| `MOBILE_LARGE_BANNER` | Mobile Large Banner  | 320×100      |
| `MEDIUM_RECTANGLE`    | Medium Rectangle     | 300×250      |
| `LARGE_RECTANGLE`     | Large Rectangle      | 336×280      |
| `DESKTOP_BILLBOARD`   | Desktop Billboard    | Variable     |
| `SIDEBAR`             | Sidebar              | 300×600      |
| `IN_ARTICLE`          | In-article           | Variable     |
| `STICKY_BOTTOM`       | Sticky Bottom        | Variable     |
| `POPUP_OVERLAY`       | Popup / Overlay      | Variable     |
| `VIDEO`               | Video                | Variable     |
| `NATIVE`              | Native Advertisement | Variable     |
| `SPONSORED_NEWS`      | Sponsored News       | Variable     |

## Architecture:

                         ┌─────────────────────┐
                         │   advertisements    │
                         └──────────┬──────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
                 ▼                  ▼                  ▼
          ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
          │  Placement   │   │    Format    │   │  Targeting   │
          └──────────────┘   └──────────────┘   └──────────────┘
                 │                  │                  │
                 ▼                  ▼                  ▼
          Where it appears    What it looks like   Who sees it
                 │                  │                  │
                 └──────────────────┼──────────────────┘
                                    ▼
                             Schedule + Priority
                                    │
                                    ▼
                              Public Ad API
                                    │
                                    ▼
                              NewsTime Website

## Folder structure:

Advertisement Management
│
├── Advertisements
│ ├── List
│ ├── Create
│ ├── Edit
│ ├── Activate / Deactivate
│ └── Preview
│
├── Placements
│ └── Placement Master
│
├── Formats
│ └── Format Master
│
├── Targeting
│ ├── Geographic
│ ├── Category
│ └── News
│
├── Campaigns
│ └── Future phase
│
└── Analytics
└── Future phase

Phase 1 → Database design + migration
Phase 2 → Advertisement backend CRUD
Phase 3 → Advertisement public-selection API
Phase 4 → Admin Advertisement UI
Phase 5 → Integrate ads into Home/News/Category/Search/E-Paper
Phase 6 → Campaign + analytics

## database relationship

                         ┌──────────────────────┐
                         │ advertisement_campaigns
                         └──────────┬───────────┘
                                    │
                                    │ 1:N
                                    ▼
                         ┌──────────────────────┐
                         │   advertisements     │
                         └───────┬───────┬──────┘
                                 │       │
                           N:1   │       │   N:1
                                 ▼       ▼
                    ┌──────────────┐  ┌──────────────┐
                    │ placements   │  │   formats    │
                    └──────┬───────┘  └──────┬───────┘
                           │                 │
                           └───────┬─────────┘
                                   ▼
                     placement_formats
                                   │
                                   │
                     ┌─────────────┴─────────────┐
                     │                           │
                     ▼                           ▼
          advertisement_media          advertisement_targets

## Releases:

Release 1 — immediately useful

Admin

Advertisement list
Create
Edit
Activate / deactivate
Schedule
Priority
Placement
Format
Desktop/mobile creative
Targeting foundation

Public

News List advertisements
News Detail advertisements
----------------

Release 2

Homepage
Category pages
Search
E-Paper
-------------------

Release 3

Campaign management
Impression tracking
Click tracking
CTR
Advertisement reports
------------------------

## advertisement_placements

| Code                             | Name                           | Initial Release |
| -------------------------------- | ------------------------------ | --------------- |
| `NEWS_LIST_TOP`                  | News List Top                  | ✅              |
| `NEWS_LIST_BETWEEN_NEWS`         | News List Between News         | ✅              |
| `NEWS_LIST_BOTTOM`               | News List Bottom               | ✅              |
| `NEWS_DETAIL_TOP`                | News Detail Top                | ✅              |
| `NEWS_DETAIL_BETWEEN_PARAGRAPHS` | News Detail Between Paragraphs | ✅              |
| `NEWS_DETAIL_SIDEBAR`            | News Detail Sidebar            | ✅              |
| `NEWS_DETAIL_BOTTOM`             | News Detail Bottom             | ✅              |
| `HOMEPAGE_TOP`                   | Homepage Top                   | Later           |
| `HOMEPAGE_BELOW_HERO`            | Homepage Below Hero            | Later           |
| `HOMEPAGE_BETWEEN_SECTIONS`      | Homepage Between Sections      | Later           |
| `HOMEPAGE_SIDEBAR`               | Homepage Sidebar               | Later           |
| `HOMEPAGE_BOTTOM`                | Homepage Bottom                | Later           |
| `CATEGORY_PAGE_TOP`              | Category Page Top              | Later           |
| `CATEGORY_PAGE_BETWEEN_NEWS`     | Category Page Between News     | Later           |
| `SEARCH_RESULTS`                 | Search Results                 | Later           |
| `EPAPER_PAGE`                    | E-Paper Page                   | Later           |

---

## Format master

| Code                  | Format               | Recommended Size |
| --------------------- | -------------------- | ---------------- |
| `LEADERBOARD`         | Leaderboard          | 728×90           |
| `MOBILE_BANNER`       | Mobile Banner        | 320×50           |
| `MOBILE_LARGE_BANNER` | Mobile Large Banner  | 320×100          |
| `MEDIUM_RECTANGLE`    | Medium Rectangle     | 300×250          |
| `LARGE_RECTANGLE`     | Large Rectangle      | 336×280          |
| `SIDEBAR`             | Sidebar              | 300×600          |
| `IN_ARTICLE`          | In-article           | Responsive       |
| `STICKY_BOTTOM`       | Sticky Bottom        | Responsive       |
| `NATIVE`              | Native Advertisement | Responsive       |
| `SPONSORED_NEWS`      | Sponsored News       | Responsive       |
| `VIDEO`               | Video                | Responsive       |
| `POPUP_OVERLAY`       | Popup / Overlay      | Responsive       |
| `DESKTOP_BILLBOARD`   | Desktop Billboard    | Responsive       |

---

Recommended implementation order

Phase 1 — Advertisement DB + master data
→ Phase 2 — Advertisement Backend API
→ Phase 3 — Advertisement Admin UI
→ Phase 4 — News List integration
→ Phase 5 — News Detail integration
→ Phase 6 — Testing and production readiness

              Advertisement Engine
                       │
       ┌───────────────┼────────────────┐
       ↓               ↓                ↓

Fixed Ads Flow Ads Modal Ads
│ │ │
↓ ↓ ↓
Homepage After N news Overlay
News List Between sections
News Detail Between content
Sidebar
Bottom

## Advertisement Management - Database Foundation

Advertisement
│
├── Creative
├── Format
├── Schedule
├── Targeting
└── Placement
│
└── Display / Insertion Rules

## Advertisement Placement

| Placement               | Page        | Behavior              |
| ----------------------- | ----------- | --------------------- |
| `HOME_BANNER`           | Homepage    | Fixed                 |
| `HOME_TOP`              | Homepage    | Fixed                 |
| `HOME_BETWEEN_SECTIONS` | Homepage    | Between sections      |
| `HOME_SIDEBAR`          | Homepage    | Fixed                 |
| `NEWS_LIST_TOP`         | News List   | Fixed                 |
| `NEWS_LIST_BETWEEN`     | News List   | After N news          |
| `NEWS_LIST_BOTTOM`      | News List   | Fixed                 |
| `NEWS_DETAIL_TOP`       | News Detail | Fixed                 |
| `NEWS_DETAIL_BETWEEN`   | News Detail | After N content units |
| `NEWS_DETAIL_SIDEBAR`   | News Detail | Fixed                 |
| `NEWS_DETAIL_BOTTOM`    | News Detail | Fixed                 |
| `NEWS_DETAIL_MODAL`     | News Detail | Overlay               |

## Proposed relationship

                    ┌──────────────────────┐
                    │ advertisement_formats│
                    └──────────┬───────────┘
                               │
                               │

┌──────────────────┐ │
│ advertisements │───────────┘
└────────┬─────────┘
│
├───────────────┐
│ │
↓ ↓
┌─────────────────┐ ┌─────────────────────┐
│advertisement_ │ │advertisement_targets│
│creatives │ └─────────────────────┘
└─────────────────┘
│
↓
┌─────────────────────────────┐
│advertisement_placement_rules│
└──────────────┬──────────────┘
│
↓
┌─────────────────────┐
│advertisement_ │
│placements │
└─────────────────────┘

## Conceptually:

Advertisement
↓
Creative
↓
Placement
↓
Targeting
↓
Insertion Rule
↓
Schedule / Priority
↓
Frontend Advertisement Composer

---

## Final proposed Advertisement data model

advertisement_business_types
│
▼
advertisement_clients
│
├─────────────────────┐
▼ ▼
advertisement_campaigns advertisements
│
┌─────────────────────┼──────────────────────┐
│ │ │
▼ ▼ ▼
advertisement_ advertisement_ advertisement_
payments creatives targets
│
│
▼
financial summary

advertisements
│
▼
advertisement_placement_rules
│
▼
advertisement_schedules

---

AD_CREATOR
│
▼
DRAFT
│
▼
SUBMITTED
│
▼
AD_MANAGER
│
├── REJECTED
│ │
│ └── AD_CREATOR → revise → SUBMITTED
│
▼
APPROVED
│
▼
SCHEDULED
│
▼
ACTIVE
│
▼
COMPLETED

---

CLIENT
│
└── AD CREATION HOLD
│
├── TRUE → new ad creation blocked
│
└── FALSE → normal workflow

---

Existing Advertisement
│
├── Existing Creative
│ └── same Cloudinary asset
│
├── Old Schedule
│
└── New Schedule
↓
Reuse same Ad
Reuse same Creative
No duplicate upload

## workflow map :

DRAFT     → SUBMITTED
SUBMITTED → APPROVED / REJECTED
APPROVED  → ON_HOLD / ARCHIVED
REJECTED  → SUBMITTED
ON_HOLD   → APPROVED / ARCHIVED
ARCHIVED  → DRAFT

---

## complete client/payment workflow

                         ┌──────────────────┐
                         │      CLIENT      │
                         └────────┬─────────┘
                                  │
                         Payment monitoring
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
              Payment OK                  Payment default
                    │                           │
                    │                    Automatic/Manual
                    │                           │
                    │                           ▼
                    │                     ┌──────────┐
                    │                     │   HOLD   │
                    │                     └────┬─────┘
                    │                          │
                    │                   Ad Manager
                    │                          │
                    │                    Manual Un-Hold
                    │                          │
                    │                    Mandatory remarks
                    │                          │
                    └──────────────────────────┘
                               │
                               ▼
                            UN-HOLD

---

## advertisement workflow

AD CREATOR
│
▼
DRAFT
│
▼
SUBMITTED
│
▼
AD MANAGER
│
├──────────► REJECTED
│ │
│ ▼
│ EDIT
│ │
│ └────► SUBMITTED
│
▼
APPROVED
│
▼
SCHEDULED

### Permission assignment

## Ad Creator - Assign:

advertisements.read
advertisements.create
advertisements.update
advertisements.submit

## Ad Manager - Assign:

advertisements.read
advertisements.update
advertisements.approve
advertisements.reject
advertisements.hold
advertisements.resume
advertisements.archive

advertisements.submit

## Permission API

| Method | Endpoint                                      | Permission               |
| ------ | --------------------------------------------- | ------------------------ |
| GET    | `/api/v1/advertisements`                      | `advertisements.read`    |
| GET    | `/api/v1/advertisements/:id`                  | `advertisements.read`    |
| GET    | `/api/v1/advertisements/:id/workflow-history` | `advertisements.read`    |
| POST   | `/api/v1/advertisements`                      | `advertisements.create`  |
| PATCH  | `/api/v1/advertisements/:id`                  | `advertisements.update`  |
| POST   | `/api/v1/advertisements/:id/submit`           | `advertisements.submit`  |
| POST   | `/api/v1/advertisements/:id/approve`          | `advertisements.approve` |
| POST   | `/api/v1/advertisements/:id/reject`           | `advertisements.reject`  |
| POST   | `/api/v1/advertisements/:id/hold`             | `advertisements.hold`    |
| POST   | `/api/v1/advertisements/:id/resume`           | `advertisements.resume`  |
| POST   | `/api/v1/advertisements/:id/archive`          | `advertisements.archive` |

---

| Workflow API                | Tests                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `POST /:id/submit`          | DRAFT → SUBMITTED                                                                     |
|                             | REJECTED → SUBMITTED                                                                  |
|                             | Reject invalid source status                                                          |
| `POST /:id/approve`         | SUBMITTED → APPROVED                                                                  |
|                             | Reject approval from invalid status                                                   |
| `POST /:id/reject`          | SUBMITTED → REJECTED                                                                  |
|                             | Require rejection reason                                                              |
| `POST /:id/hold`            | APPROVED → ON_HOLD                                                                    |
|                             | Require hold reason                                                                   |
| `POST /:id/resume`          | ON_HOLD → APPROVED                                                                    |
|                             | Reject resume from invalid status                                                     |
| `POST /:id/archive`         | APPROVED → ARCHIVED                                                                   |
|                             | ON_HOLD → ARCHIVED                                                                    |
|                             | Reject archive from invalid status                                                    |
| `GET /:id/workflow-history` | Returns history in reverse chronological order                                        |
|                             | Non-existent advertisement → 404                                                      |
| Workflow history            | Verify every transition records `from_status`, `to_status`, `remarks`, `performed_by` |
| Authorization               | Verify users without the relevant workflow permission receive `403`                   |
| Transaction safety          | Verify an invalid transition does not create a history row                            |

---

## A clean structure would be:

advertisements
→ What the advertisement is

advertisement_placements
→ Where it can appear

advertisement_delivery_rules
→ How often/under what conditions it appears

advertisement_workflow_history
→ Approval/audit history

advertisement_payments
→ Financial settlement

---

## Placement & Delivery Rules

We should implement the backend foundation for:

Advertisement placements
-------------------------

Homepage
News List
News Detail
Search
E-Paper
Future placements without changing the advertisement table

Placement configuration
-----------------------

Placement type/code
Display position
Priority
Active/inactive
Desktop/mobile applicability

Insertion frequency
-------------------

Every N articles
Top/bottom
Between content
First position
Random/priority-based placement where required

Targeting
---------

All pages
Specific news scope: STATE, INDIA, WORLD, DISTRICT
Specific category
Potentially specific district/state later

Scheduling
----------

start_at
end_at
Approved advertisements only
Automatically exclude expired/not-yet-started ads

Priority selection
------------------

Higher-priority eligible advertisements first
Multiple eligible advertisements supported
No hard-coded advertisement IDs

Delivery API
-------------

Eventually something like:

GET /api/v1/advertisements/delivery?placement=HOME_TOP

returning only advertisements that are actually eligible for that placement at the current time.

---

## API routing hierarchy

/api/v1/advertisements/
├── /
├── /placement-rules
├── /placement-rules/:id
├── /:id/workflow-history
├── /:id
├── /:id/submit
├── /:id/approve
├── /:id/reject
├── /:id/hold
├── /:id/resume
└── /:id/archive

## SCHEDULED

| Operation | Endpoint                       | Purpose                                   |
| --------- | ------------------------------ | ----------------------------------------- |
| Activate  | `POST /schedules/:id/activate` | Start an approved/scheduled advertisement |
| Pause     | `POST /schedules/:id/pause`    | Temporarily stop delivery                 |
| Resume    | `POST /schedules/:id/resume`   | Return PAUSED schedule to ACTIVE          |
| Complete  | `POST /schedules/:id/complete` | Mark finished schedule                    |
| Cancel    | `POST /schedules/:id/cancel`   | Permanently cancel future delivery        |

---

find eligible CLIENT advertisements
│
▼
any eligible?
/ \
YES NO
│ │
│ placement fallback?
│ / \
│ HIDE HOUSE
│ │ │
│ ▼ ▼
│ return find eligible
│ [] HOUSE ad
│ │
│ found?
│ / \
│ YES NO
│ │ │
└───────────────┘ ▼
return []

## Delivery Architecture

                    Advertisement Delivery
                             │
                             ▼
                    Requested Placement
                             │
                ┌────────────┴────────────┐
                │                         │
          Eligible Paid Ad?          No Paid Ad
                │                         │
               YES                        ▼
                │                  fallback = HOUSE_AD?
                ▼                         │
          Return Paid Ad                 YES
                                          │
                                          ▼
                              Eligible House Ad?
                                   │           │
                                  YES          NO
                                   │           │
                                   ▼           ▼
                            Return House Ad   Empty

---

Preferred Placement
↓
Occupied by paid ad
↓
Configured House-Ad Placement #2
↓
Occupied
↓
Configured House-Ad Placement #3
↓
Available
↓
Return House Ad

---

## Final Achitecture

                    ┌──────────────────────┐
                    │ Advertisement Manager│
                    └──────────┬───────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
          Paid Advertisement             House Advertisement
          is_house_ad = false            is_house_ad = true
          client_id required             client_id = NULL
                │                             │
                └──────────────┬──────────────┘
                               │
                         Placement Rule
                               │
                            Schedule
                               │
                               ▼
                       Delivery Service
                               │
                    ┌──────────┴──────────┐
                    │                     │
              Paid candidates       No usable paid
                    │                     │
                    ▼                     ▼
                 RETURN             fallbackBehavior?
                                      │
                              ┌───────┴───────┐
                              │               │
                             HIDE          HOUSE_AD
                              │               │
                            EMPTY       Find house ad
                                              │
                                              ▼
                                        RETURN HOUSE_AD

------------------------------------

Rate Card
   ↓
Advertisement
   ↓
Placement
   ↓
Pricing Snapshot
   ↓
Standard Amount
   ↓
Agreed Amount
   ↓
Financial Approval
   ↓
Payment
   ↓
Schedule