import { findDocuments, extractDocuments } from '../lib/pipeline';

async function run() {
  const urls = await findDocuments(process.argv[2] || 'Transportation Authority');
  console.log(`\n🔗 ${urls.length} URLs to extract\n`);

  const docs = await extractDocuments(urls);

  docs.forEach((d, i) => {
    console.log(`\n${i + 1}. ${d.title} (${d.numPages} pages)`);
    console.log(`   ${d.url}`);
    console.log(`   Preview: ${d.content.slice(0, 200)}...`);
  });
}
run().catch(console.error);