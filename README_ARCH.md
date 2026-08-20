## Proposed Architecture :

React (Frontend)
│
│ Axios
▼
Node.js API (Express + TypeScript)
│
│ Repository Layer
▼
Neon PostgreSQL
│
▼
Cloudinary

## Database Design:

## Masters

countries
states
districts
categories

## Security

users
roles

## Publishing

news
news_images
cloudinary_assets

## Analytics

news_reads
site_visits

## Relations

related_news

## Database Relationship:

Country
│
├── State
│ │
│ ├── District
│
│
News
│
├── Category
│
├── Thumbnail Image
│
├── Cover Image
│
└── Banner Image

News
│
├── News Images

News
│
├── Related News

News
│
├── Read Count

Site
│
├── Visit Count

## Folder Structure

## Backend

backend/

src/

config/

controllers/

middlewares/

repositories/

services/

routes/

validators/

utils/

types/

models/

database/

migrations/

seed/

server.ts

## Frontend

src/

api/

components/

pages/

layouts/

hooks/

contexts/

types/

utils/

assets/

routes/

services/

## React Pages

Home

Coverage Listing

State Listing

District Listing

Category Listing

News Detail

Search

404

## Navigation

/

↓

/news/tamil-nadu

↓

/news/tamil-nadu/chennai

↓

News Detail

## Components

Header

Footer

Top Navigation

Coverage Menu

News Card

News List

Thumbnail

Category Badge

Related News

Breadcrumb

Pagination

## Backend Modules

Country Module

State Module

District Module

Category Module

News Module

Image Module

Analytics Module

Each module has ->
Controller

Service

Repository

Validator

Types

## API Structure

/api

/auth

/countries

/states

/districts

/categories

/news

/images

/analytics

---

## Other packages (all free)

| Purpose          | Package            | License  |
| ---------------- | ------------------ | -------- |
| Authentication   | jsonwebtoken       | MIT      |
| Password hashing | bcrypt             | MIT      |
| Validation       | Zod                | MIT      |
| Logging          | Pino               | MIT      |
| Cache            | Redis              | BSD      |
| UUID             | uuid               | MIT      |
| File Upload      | Multer             | MIT      |
| Cloudinary SDK   | cloudinary         | MIT      |
| API Docs         | Swagger            | Apache 2 |
| Testing          | Vitest             | MIT      |
| HTTP Testing     | Supertest          | MIT      |
| Environment      | dotenv             | BSD      |
| Security         | Helmet             | MIT      |
| CORS             | cors               | MIT      |
| Compression      | compression        | MIT      |
| Rate Limiter     | express-rate-limit | MIT      |

Technology Stack

| Component        | Technology          |
| ---------------- | ------------------- |
| Runtime          | Node 22 LTS         |
| Framework        | Express             |
| Language         | TypeScript          |
| Database         | PostgreSQL (Neon)   |
| Validation       | Zod                 |
| Authentication   | JWT                 |
| Password Hashing | bcrypt              |
| Logging          | Pino                |
| Cache            | Redis               |
| Upload           | Multer + Cloudinary |
| Testing          | Vitest              |
| Documentation    | Swagger/OpenAPI     |
| Package Manager  | npm                 |

///////////////////// Overall Deployment Architecture ////////////////
GitHub
│
┌────────────┴─────────────┐
│ │
▼ ▼
Vercel (React) Vercel (Node API)
thenewstime.in api.thenewstime.in
│ │
└──────────────┬───────────┘
│
Neon PostgreSQL

Frontend
https://thenewstime.in

Backend
https://api.thenewstime.in

                         NEWS
                           │
             ┌─────────────┴─────────────┐
             │                           │
        NEWS SCOPE                  CATEGORY
             │                           │
     ┌───────┼────────┐          Politics
     │       │        │          Government

STATE NATIONAL INTERNATIONAL Crime
│ │ │ Education
│ │ │ Sports
│ │ │ Health
│ │ │ ...
│ │ │
│ │ └── Country
│ │
│ └── Country
│
└── Country
│
└── State
│
└── District

Database master data
↓
Repository
↓
News domain type
↓
Mapper
↓
Service
↓
Controller
↓
API response

///////////////////////

repository
↓
service
↓
DTO
↓
controller
↓
API response

//////////////////////
Flow:
Request
│
▼
Controller
getNewsBySlug()
│
▼
Service
getNewsBySlug()
│
▼
Repository
findBySlug()
│
▼
SQL
news
├── categories
├── countries
├── states
└── districts
│
▼
mapNews()
│
▼
NewsResponseDto

// router.get("/", getAllNews);
// router.get("/:id", getNewsById);
// router.post("/", createNews);
// router.put("/:id", updateNews);
// router.patch("/:id", patchNews);
// router.delete("/:id", deleteNews);

GET /
GET /slug/:slug
PATCH /:id/status
PATCH /:id/approve
PATCH /:id/publish
PATCH /:id/archive
GET /:id
POST /
PUT /:id
DELETE /:id

World news
{
"newsScope": "WORLD",
"countryId": null,
"stateId": null,
"districtId": null
}

India / National news
{
"newsScope": "INDIA",
"countryId": 1,
"stateId": null,
"districtId": null
}

State news
{
"newsScope": "STATE",
"countryId": 1,
"stateId": 1,
"districtId": null
}

District news
{
"newsScope": "DISTRICT",
"countryId": 1,
"stateId": 1,
"districtId": 1
}

Database
↓
WORLD
INDIA
STATE
DISTRICT
↓
API validation
↓
TypeScript NewsScope
↓
API filtering
↓
News DTO
↓
React UI
↓
URL / slug navigation

                         thenewstime.in
                               │
              ┌────────────────┴────────────────┐
              │                                 │
          PUBLIC API                        ADMIN API
              │                                 │
      ┌───────┼────────┐              ┌─────────┼─────────┐
      │       │        │              │         │         │
     News   Search   Media          News      Media    Master
      │                         Management             Data
      │
      ▼

PostgreSQL
│
┌────┼──────────────────────────────────┐
│ │ │ │ │
news media_assets news_media categories locations
│
└───────────────┐
▼
Cloudinary

The future architecture is:
---------------------------

React Admin
│
│ multipart upload
▼
Node API
│
├── PostgreSQL
│
└── Cloudinary

| Current   | Next      | Allowed |
| --------- | --------- | ------- |
| DRAFT     | IN_REVIEW | ✅      |
| DRAFT     | APPROVED  | ❌      |
| DRAFT     | PUBLISHED | ❌      |
| IN_REVIEW | APPROVED  | ✅      |
| IN_REVIEW | REJECTED  | ✅      |
| IN_REVIEW | PUBLISHED | ❌      |
| APPROVED  | PUBLISHED | ✅      |
| APPROVED  | ARCHIVED  | ❌      |
| PUBLISHED | ARCHIVED  | ✅      |
| ARCHIVED  | anything  | ❌      |
| REJECTED  | DRAFT     | ✅      |

Final workflow:
---------------

                    ADMIN
                      │
                      ▼
                  CREATE NEWS
                      │
                      ▼
                    DRAFT
                      │
              Submit for Review
                      │
                      ▼
                  IN_REVIEW
                  /         \
                 /           \
             Reject         Approve
               │               │
               ▼               ▼
             DRAFT          APPROVED
                               │
                             Publish
                               │
                               ▼
                           PUBLISHED
                               │
                          Deactivate
                               │
                               ▼
                           ARCHIVED

                    ┌──────────────┐
                    │    DRAFT     │
                    └──────┬───────┘
                           │
                    Submit for review
                           │
                           ▼
                  ┌────────────────┐
                  │   IN_REVIEW    │
                  └───────┬────────┘
                          │
                 ┌────────┴────────┐
                 │                 │
              Approve           Reject
                 │                 │
                 ▼                 ▼
          ┌──────────────┐       DRAFT
          │   APPROVED   │
          └──────┬───────┘
                 │
              Publish
                 │
                 ▼
          ┌──────────────┐
          │  PUBLISHED   │
          └──────┬───────┘
                 │
              Archive
                 │
                 ▼
          ┌──────────────┐
          │   ARCHIVED   │
          └──────────────┘

Public Side:
------------

                 DATABASE
                     │
                     ▼
              ┌──────────────┐
              │ PUBLISHED ?  │
              └──────┬───────┘
                     │
              YES ───┴─── NO
               │            │
               ▼            ▼
           PUBLIC API      hidden
               │
               ▼
            HomePage
               │
        ┌──────┼───────┐
        ▼      ▼       ▼
      Hero   Latest   Sections

Expected API structure
-----------------------

| Endpoint                             | Purpose              | Statuses           |
| ------------------------------------ | -------------------- | ------------------ |
| `GET /api/v1/news`                   | Admin news list      | All                |
| `GET /api/v1/news/:id`               | Admin detail         | All                |
| `GET /api/v1/news/slug/:slug`        | Admin detail by slug | All                |
| `GET /api/v1/news/public`            | Website news list    | **PUBLISHED only** |
| `GET /api/v1/news/public/slug/:slug` | Website article      | **PUBLISHED only** |
| `POST /api/v1/news`                  | Create               | —                  |
| `PUT /api/v1/news/:id`               | Update               | —                  |
| `PATCH /api/v1/news/:id/approve`     | Approve              | DRAFT/IN_REVIEW    |
| `PATCH /api/v1/news/:id/publish`     | Publish              | APPROVED           |
| `PATCH /api/v1/news/:id/archive`     | Archive              | PUBLISHED          |
| `POST /api/v1/news/:id/promote`      | Promote              | PUBLISHED          |

Final workflow
---------------

CREATE
│
▼
Save Draft
│
▼
DRAFT
│
├── Submit for Review ──► IN_REVIEW
│ │
│ ├── Approve ──► APPROVED
│ │ │
│ │ └── Publish ──► PUBLISHED
│ │ │
│ │ ├── Promote 3 days
│ │ │
│ │ └── Deactivate
│ │ │
│ └── Reject ──► REJECTED ARCHIVED
│ │
│ └── Draft
│
└── Approve ──► APPROVED

DRAFT
  ↓ approve
PUBLISHED
  ↓ archive/deactivate
ARCHIVED
  ↓ activate
DRAFT
  ↓ edit
DRAFT
  ↓ approve
PUBLISHED