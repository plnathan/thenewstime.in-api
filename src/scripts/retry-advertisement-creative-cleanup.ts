// To run this script
// npx tsx src/scripts/retry-advertisement-creative-cleanup.ts

// If tsx is not installed, you can install it as a development dependency:
// npm install -D tsx


import "dotenv/config";

import { processArchiveCreativeCleanup } from "../api/v1/advertisements/advertisement/advertisement-archive-cleanup.service.js";

async function main(): Promise<void> {
  const advertisementId = 2340;

  console.log(
    `Retrying Cloudinary cleanup for advertisement ${advertisementId}`
  );

  const result = await processArchiveCreativeCleanup(advertisementId, 10);

  console.log("Cleanup result:", result);

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error("Cleanup retry failed:", error);
  process.exitCode = 1;
});
