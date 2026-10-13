import path from "node:path";

/** Desktop supplies its writable user-data directory; web keeps its existing cache. */
export function githubDataPath(name: string): string {
  return path.join(/* turbopackIgnore: true */ process.env.GITHUB_MONITOR_DATA_DIR || path.join(process.cwd(), ".next", "cache", "github-monitor"), name);
}
