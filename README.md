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
