import { runCli } from "../scrapers/dracinema/cli.js";

export * from "../scrapers/dracinema/cli.js";

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
