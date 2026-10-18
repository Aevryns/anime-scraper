import { scrapers, listScrapers, getScraper } from "./scrapers/index.js";

function printGlobalBanner(): void {
  console.log("=".repeat(65));
  console.log("   WEB-SCRAPER SUITE (Modular TypeScript/Node.js Data Scraper)");
  console.log("=".repeat(65));
}

function printHelp(): void {
  printGlobalBanner();
  console.log("\nUsage:");
  console.log("  npx tsx src/cli.ts <scraper> [options...]");
  console.log("  npm run dracinema -- [options...]");
  console.log("  npm run animeindo -- [options...]");
  console.log("\nAvailable Scrapers:");
  for (const s of listScrapers()) {
    console.log(`  - ${s.id.padEnd(12)} : ${s.name} (${s.baseUrl})`);
    console.log(`                   ${s.description}`);
  }
  console.log("\nExamples:");
  console.log("  npx tsx src/cli.ts dracinema --search \"boss\"");
  console.log("  npx tsx src/cli.ts dracinema --playback \"1-hp-summon-tanpa-batas-dw_o6OsDcj9f2\" --episode 1");
  console.log("  npx tsx src/cli.ts dracinema --all");
  console.log("  npx tsx src/cli.ts dracinema --summary");
  console.log("  npx tsx src/cli.ts animeindo --search \"naruto\"");
  console.log("  npx tsx src/cli.ts animeindo --summary");
  console.log("=".repeat(65));
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  const firstArg = argv[0].toLowerCase();

  // Direct scraper match
  const scraper = getScraper(firstArg);
  if (scraper) {
    await scraper.runCli(argv.slice(1));
    return;
  }

  // Backward compatibility: If an option flag is passed directly (e.g. --all, --summary)
  if (firstArg.startsWith("--")) {
    console.log(`[*] No scraper specified, defaulting to 'animeindo' for backward compatibility.`);
    const animeindo = getScraper("animeindo");
    if (animeindo) {
      await animeindo.runCli(argv);
      return;
    }
  }

  console.error(`[-] Unknown scraper or command: '${firstArg}'\n`);
  printHelp();
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
