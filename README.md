## to build back-end

npx tsc -p tsconfig.vercel.json

## Testing API

https://thenewstime-in-api-swart.vercel.app/api/v1/news/public?page=1&pageSize=4&popular=true&utm_source=chatgpt.com

## Learn Prisma/Drizzle

Install Prettier

cd back-end
npm install -D prettier

project-root/.prettierrc

npm install -D prettier

and keep one shared config:

project-root/.prettierrc
{
"semi": true,
"singleQuote": false,
"trailingComma": "none"
}

add format scripts in front-end/package.json

{
"scripts": {
"format": "prettier --write ."
}
}

npm run format

// ---------------------

Backend (Node + Express + TypeScript) — install ESLint

npm install -D eslint @eslint/js typescript-eslint globals

Run backend lint

npm run lint

To auto-fix where possible:

npm run lint:fix

---

npm install -D @vitest/coverage-v8

npm run test

npm run test:coverage
or
npm test -- --coverage

for integration testing one specific file
npx vitest run src/tests/integration/news.api.test.ts
or
npm run test -- src/tests/integration/news.api.test.ts
---

Install Supertest:
------------------

npm install -D supertest

npm install -D @types/supertest

To run integration test:

To run all test:
npx vitest run

To run individual test:
npx vitest run src/tests/integration/news.api.test.ts
or
npm run test -- src/tests/integration/news.api.test.ts

Swagger Documentation:
----------------------

npm install swagger-ui-express

npm install -D @types/swagger-ui-express

Install YAML Parser
-------------------

npm install yamljs

npm install -D @types/yamljs

Zod Open API validation
-----------------------

npm install @asteasolutions/zod-to-openapi

Scalar API Reference:
--------------------

npm install @scalar/api-reference

To run the specific file test
------------------------------

Get-ChildItem -Path src -Recurse -Include *.ts | Select-String -Pattern 'export type AuthRole|export enum AuthRole|type AuthRole'

Get-ChildItem -Path src -Recurse -Include *.ts | Select-String -Pattern 'AuthRole'

npm test -- advertisements/advertisement

npm test -- advertisements/placements

npm test -- advertisements/placement-rules

If your Vitest configuration does not match that filename filter, use:

npx vitest run src/api/v1/advertisements/advertisement/tests

npx vitest run src/api/v1/advertisements/advertisement/tests/advertisement.validation.test.ts

npx vitest run src/api/v1/advertisements/advertisement/tests/advertisement.service.test.ts

npx vitest run src/api/v1/advertisements/advertisement/tests/advertisement.repository.test.ts

npx vitest run src/api/v1/advertisements/advertisement/tests/advertisement.controller.test.ts

npx vitest run src/api/v1/advertisements/advertisement/tests/advertisement.integration.test.ts

npx vitest run src/api/v1/advertisements/advertisement/tests/advertisement.workflow.integration.test.ts

Then run the complete test suite:

npm run test:run

npx vitest run

npx vitest

npx vitest run src/api/v1/news/tests/news.integration.test.ts

npx vitest run src/api/v1/news/tests/news.controller.test.ts

npx vitest run src/api/v1/news/tests/news.repository.test.ts

npx vitest run src/api/v1/news/tests/news.service.test.ts

npx vitest src/api/v1/news-reads/tests/news-reads.integration.test.ts

npx vitest run src/api/v1/security/tests/auth.integration.test.ts

npx vitest run src/api/v1/security/auth/tests/auth.service.test.ts

npx vitest run src/api/v1/security/tests/users.integration.test.ts

npx vitest run src/api/v1/security/users/tests/user.repository.test.ts

npx vitest run src/api/v1/security/tests/roles.integration.test.ts

npx vitest run src/api/v1/security/roles/tests/role.validation.test.ts

npx vitest run src/api/v1/security/permissions/tests/permission.service.test.ts

npx vitest run src/api/v1/security/permissions/tests/permission.repository.test.ts

npx vitest run src/api/v1/security/permissions/tests

npx vitest run src/api/v1/advertisements/advertisement/tests/advertisement.workflow.integration.test.ts

npm test -- advertisement.workflow.integration.test.ts

npm test -- placement.integration.test.ts

npm test -- placement.controller.test.ts placement.service.test.ts placement.repository.test.ts placement.validation.test.ts

npx vitest run src/api/v1/advertisements/placement

npm test -- placement.integration.test.ts

npx vitest run src/api/v1/advertisements/placement-rules/tests/placement-rule.validation.test.ts

npx vitest run src/api/v1/advertisements/placement-rules/tests/placement-rule.repository.test.ts

npx vitest run src/api/v1/advertisements/placement-rules/tests/placement-rule.service.test.ts

npx vitest run src/api/v1/advertisements/placement-rules/tests/placement-rule.controller.test.ts

npx vitest run src/api/v1/advertisements/placement-rules/tests/placement-rule.integration.test.ts

npm test -- advertisements/placement-rules

npx vitest run src/api/v1/advertisements/schedules/tests/schedule.validation.test.ts

npx vitest run src/api/v1/advertisements/schedules/tests/schedule.repository.test.ts

npx vitest run src/api/v1/advertisements/schedules/tests/schedule.service.test.ts

npx vitest run src/api/v1/advertisements/schedules/tests/schedule.controller.test.ts

npx vitest run src/api/v1/advertisements/schedules/tests/schedule.integration.test.ts

npm test -- advertisements/schedules

npx vitest run src/api/v1/advertisements/schedules/tests

npx vitest run src/api/v1/advertisements/delivery/tests/delivery.controller.test.ts

npx vitest run src/api/v1/advertisements/delivery/tests/delivery.service.test.ts

npx vitest run src/api/v1/advertisements/delivery/tests/delivery.repository.test.ts

npx vitest run src/api/v1/advertisements/delivery/tests/delivery.validation.test.ts

npx vitest run src/api/v1/advertisements/formats/tests/format.repository.test.ts

npx vitest run src/api/v1/advertisements/targets/tests/target.repository.test.ts

npm test -- advertisements/delivery

npx vitest run src/api/v1/advertisements/advertisement/tests/advertisement.repository.test.ts src/api/v1/advertisements/advertisement/tests/advertisement.service.test.ts

npx vitest run src/api/v1/advertisements/delivery/tests/delivery.integration.test.ts

npx vitest run src/api/v1/advertisements/clients/tests/client.validation.test.ts

npx vitest run src/api/v1/advertisements/clients/tests/client.service.test.ts

npx vitest run src/api/v1/advertisements/clients/tests/client.repository.test.ts

npx vitest run src/api/v1/advertisements/clients/tests/client.controller.test.ts

npx vitest run src/api/v1/advertisements/clients/tests/client.integration.test.ts

npx vitest run src/api/v1/advertisements/clients/tests/

npx vitest run src/api/v1/advertisements/tracking/tests/tracking.repository.test.ts

npx vitest run src/api/v1/advertisements/tracking/tests/tracking.service.test.ts

npx vitest run src/api/v1/advertisements/tracking/tests/tracking.controller.test.ts

npx vitest run src/api/v1/advertisements/tracking/tests/tracking.validation.test.ts

npx vitest run src/api/v1/advertisements/tracking/tests/tracking.integration.test.ts
****************** XXXX *********************

Cloudinary
----------

npm install cloudinary multer
npm install -D @types/multer

Install the authentication packages
-----------------------------------

npm install bcrypt jsonwebtoken
npm install -D @types/bcrypt @types/jsonwebtoken

use this for generating the secret in powershell:
--------------------------------------------------

node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

PS C:\Users\Sathvik-Dharsha> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
7a58aa0b087ea4bc1d225ac37089416c5d9261e45d01dd26f22b0792c9c7cd6c7d2156da387ac5f5a46257cbe0bee3519e57a001adfa8995bb5bb9d0ae2c8c70

Password as per seed:
-----------------------

$2b$12$REPLACE_WITH_BCRYPT_HASH

Run in the Terminal:
---------------------

node -e "const bcrypt=require('bcrypt'); bcrypt.hash('YourStrongPasswordHere',12).then(console.log)"

node -e "const bcrypt=require('bcrypt'); bcrypt.hash('Test@12345',12).then(console.log)"

Update the generated PWD:
------------------------

UPDATE users
SET
password_hash = 'PASTE_BCRYPT_HASH_HERE',
password_changed_at = NULL,
must_change_password = true,
updated_at = NOW()
WHERE username = 'admin';

// $2b$12$P47gzf9qbo3FNam6YL9lIuIY3q8cYpvAOCT.pB/DZmCHxIqGByxgK

## build command

npx tsc -p tsconfig.vercel.json

npx vitest run src/api/v1/advertisements/schedules/tests/schedule.integration.test.ts --hookTimeout 30000

## The worker can be run manually for verification using:

npx tsx scripts/run-cloudinary-cleanup.ts

## Vercel Secret creation(generation)

$bytes = New-Object byte[] 32; $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $rng.GetBytes($bytes); $rng.Dispose(); [BitConverter]::ToString($bytes).Replace("-", "")

## To verify CRON Endpoint in the terminal

$secret = (Get-Content .env | Where-Object { $_ -match '^CRON_SECRET=' } | Select-Object -First 1) -replace '^CRON_SECRET=', ''

Invoke-RestMethod -Uri "http://localhost:5000/api/v1/system/cloudinary-cleanup" -Headers @{ Authorization = "Bearer $secret" }

## Running again if .env changed

# Restart

npm run dev

Invoke-RestMethod -Uri "http://localhost:5000/api/v1/system/cloudinary-cleanup" -Headers @{ Authorization = "Bearer $secret" }

## To Check for a PowerShell environment override and Remove it

Get-ChildItem Env:CLOUDINARY_CLEANUP_ENABLED -ErrorAction SilentlyContinue

## If it displays false, remove the override

Remove-Item Env:CLOUDINARY_CLEANUP_ENABLED -ErrorAction SilentlyContinue

## For production checking

$secret = (Get-Content .env | Where-Object { $_ -match '^CRON_SECRET=' } | Select-Object -First 1) -replace '^CRON_SECRET=', ''

Invoke-RestMethod -Uri "https://thenewstime-in-api-swart.vercel.app/api/v1/system/cloudinary-cleanup" -Headers @{ Authorization = "Bearer $secret" }

Expected output:
success status processed

---

True PAUSED 0

## Production spam protection

The backend now includes several protective layers:

- Cloudflare Turnstile: Server-side verification before accepting production enquiries.
- IP rate limiting: Five attempts per hour and twenty per day.
- Mobile number limiting: Three attempts per day.
- Honeypot: Detects basic automated form submissions.
- Request size validation: Rejects oversized enquiry submissions.
- PostgreSQL-backed counters: Shared across Vercel serverless instances.

ENQUIRY_RATE_LIMIT_SECRET=<random-secret-at-least-32-characters>
TURNSTILE_SECRET_KEY=<cloudflare-turnstile-secret>
ENQUIRY_TURNSTILE_HOSTNAME=thenewstime.in
https://developers.cloudflare.com/turnstile/troubleshooting/testing

## Front-End:

VITE_TURNSTILE_SITE_KEY=<cloudflare-turnstile-site-key>

## To generate SECRET KEY using powershell

$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)

## Step 1 — Create the Cloudflare Turnstile widget

Open the Cloudflare Turnstile Dashboard.

1. Sign in to your Cloudflare account, or create a free account.
2. Select Turnstile.
3. Click Add widget.
4. Configure the widget using the following values:
   Setting Recommended value
   Widget name The News Time - Advertisement Enquiry
   Hostname thenewstime.in
   Widget mode Managed
   Pre-clearance Disabled / No pre-clearance

The thenewstime.in hostname also authorizes its subdomains, including www.thenewstime.in. Do not enter https:// or a URL path in the hostname field.
Cloudflare Turnstile docs+1

Click Create.

## Step 2 — Copy your keys

Cloudflare will display two values:
Site Key

Public key — add to your React frontend.

Secret Key

Private key — add only to your Node.js backend. Never expose it in frontend code or GitHub.

## Step 3 — Configure Vercel environment variables

For your existing deployment setup, configure the frontend and backend projects separately.

Frontend Vercel project

Go to Settings → Environment Variables, then add:

VITE_TURNSTILE_SITE_KEY=YOUR_CLOUDFLARE_SITE_KEY

Backend Vercel project

Add:
TURNSTILE_SECRET_KEY=YOUR_CLOUDFLARE_SECRET_KEY
ENQUIRY_TURNSTILE_HOSTNAME=thenewstime.in
ENQUIRY_RATE_LIMIT_SECRET=YOUR_RANDOM_32_PLUS_CHARACTER_SECRET

The rate-limit secret is separate from the Cloudflare keys. You can generate it using PowerShell:
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)

Copy the generated value into ENQUIRY_RATE_LIMIT_SECRET.

Configure these for the appropriate Vercel environment, then redeploy both projects so the new environment variables take effect.

## Step 4 — Test the enquiry form
