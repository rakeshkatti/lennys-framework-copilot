import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Copy every markdown file referenced by data/catalog.json from the data
 * repo into data/corpus/, preserving the newsletters/<file> and
 * podcasts/<file> structure. Idempotent — re-runs only overwrite.
 *
 * The data repo path is configurable via env so this works in CI and
 * on Replit where the data repo may not be a sibling directory.
 */

const DATA_REPO =
  process.env.LENNY_DATA_REPO ??
  "/Users/rakeshkatti/dev/lennys-newsletterpodcastdata-all";

const APP_ROOT = process.cwd(); // run from artifacts/lenny-copilot
const CATALOG_PATH = join(APP_ROOT, "data", "catalog.json");
const CORPUS_DIR = join(APP_ROOT, "data", "corpus");

interface CatalogEntryShape {
  id: string;
  source: string[];
}

function main(): void {
  if (!existsSync(DATA_REPO)) {
    throw new Error(
      `Data repo not found at ${DATA_REPO}. Set LENNY_DATA_REPO=/path/to/repo`,
    );
  }
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf-8")) as CatalogEntryShape[];

  const wanted = new Set<string>();
  for (const entry of catalog) {
    for (const file of entry.source) wanted.add(file);
  }

  let copied = 0;
  let missing = 0;
  for (const file of wanted) {
    const src = join(DATA_REPO, file);
    const dest = join(CORPUS_DIR, file);
    if (!existsSync(src)) {
      console.warn(`[copy-corpus] MISSING: ${file}`);
      missing++;
      continue;
    }
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    copied++;
  }
  console.log(
    `[copy-corpus] copied=${copied} missing=${missing} total=${wanted.size}`,
  );
  if (missing > 0) {
    console.warn(
      "[copy-corpus] some catalog source files are missing from the data repo; affected frameworks will fall back to summary-only adaptation",
    );
  }
}

main();
