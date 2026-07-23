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
          │                          │
          ▼                          ▼
     Vercel (React)             Vercel (Node API)
     thenewstime.in             api.thenewstime.in
          │                          │
          └──────────────┬───────────┘
                         │
                  Neon PostgreSQL

Frontend
https://thenewstime.in

Backend
https://api.thenewstime.in                  