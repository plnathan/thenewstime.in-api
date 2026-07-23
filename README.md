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
