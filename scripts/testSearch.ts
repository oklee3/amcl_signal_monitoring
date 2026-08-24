// scripts/testSearch.ts
import { findDocuments } from '../lib/pipeline';

async function run() {
  const sector = process.argv[2] || 'Transportation Authority';
  console.log(`\n🔎 Searching for: "${sector}"\n`);

  const results = await findDocuments(sector);

  console.log(`\n✅ ${results.length} URLs after filtering:\n`);
  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.title}`);
    console.log(`   ${r.url}`);
    console.log(`   ${r.description?.slice(0, 100)}...\n`);
  });
}

run().catch(console.error);
