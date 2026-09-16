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
