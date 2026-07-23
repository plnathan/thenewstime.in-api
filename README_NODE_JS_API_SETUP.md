Setup for Node.js API + Express + TypeScript
---------------------------------------------

mkdir back-end
cd back-end
npm init -y

npm install express cors dotenv

npm install -D typescript ts-node-dev @types/node @types/express @types/cors

// Created a new tsconfig.json
npx tsc --init

// You can learn more at https://aka.ms/tsconfig

Then update tsconfig.json like this:
{
"compilerOptions": {
"target": "ES2020",
"module": "CommonJS",
"rootDir": "./src",
"outDir": "./dist",
"strict": true,
"esModuleInterop": true,
"skipLibCheck": true
},
"include": ["src"]
}

If ts-node-dev still gives trouble with NodeNext

This happens sometimes with ESM projects. If you still see issues, the cleaner fix is to switch from ts-node-dev to tsx.

Install tsx:
------------

npm install -D tsx

Then update scripts:
"scripts": {
"dev": "tsx watch src/server.ts",
"build": "tsc",
"start": "node dist/server.js"
}
That usually works more smoothly with:
"type": "module"
"module": "nodenext"

// -----------------------------------------------

1. Install the PostgreSQL package

Inside your back-end folder:

npm install pg
npm install -D @types/pg

---

news.repository.ts (Complete)
↓
news.mapper.ts
↓
news.query.ts
↓
news.service.ts
↓
news.controller.ts
↓
news.validator.ts
↓
news.routes.ts
↓
Testing
