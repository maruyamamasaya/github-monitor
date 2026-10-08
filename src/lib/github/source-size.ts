import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { GitHubApiError, githubFetch } from "./client";
import { listRepositories } from "./dashboard";
import { withCommitCacheLock } from "./commit-cache";
import { emptySourceSizeCache, summarizeSourceSize, syncSourceSize, type SourceSizeCache } from "./source-size-sync";

const file = path.join(process.cwd(), ".next", "cache", "github-monitor", "source-size.json");

async function readCache(): Promise<SourceSizeCache> {
  try {
    const value = JSON.parse(await fs.readFile(file, "utf8")) as SourceSizeCache;
    return value.version === 1 && value.repositories && value.blobs ? value : emptySourceSizeCache();
  } catch { return emptySourceSizeCache(); }
}

export async function readSourceSize() {
  const cache = await readCache();
  const excluded = new Set((process.env.GITHUB_EXCLUDED_REPOS ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean));
  cache.repositories = Object.fromEntries(Object.entries(cache.repositories).filter(([name]) => !excluded.has(name.toLowerCase()) && !excluded.has(name.split("/")[1]?.toLowerCase())));
  return summarizeSourceSize(cache);
}

export async function updateSourceSize() {
  return withCommitCacheLock(async () => {
    const cache = await readCache();
    const summary = await syncSourceSize(cache, {
      async rate() {
        const result = await githubFetch<{ rate: { remaining: number; reset: number } }>("/rate_limit");
        return { remaining: result.rate.remaining, resetAt: new Date(result.rate.reset * 1000).toISOString() };
      },
      async repositories(request) {
        return (await listRepositories(<T>(url: string) => request(() => githubFetch<T>(url)))).repositories;
      },
      async head(repo) {
        const items = await githubFetch<{ sha: string; commit: { tree: { sha: string } } }[]>(`/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/commits?sha=${encodeURIComponent(repo.defaultBranch)}&per_page=1`);
        if (!items.length) throw new GitHubApiError(409, "Empty repository");
        return { sha: items[0].sha, treeSha: items[0].commit.tree.sha };
      },
      tree: (repo, sha, recursive) => githubFetch(`/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/git/trees/${encodeURIComponent(sha)}${recursive ? "?recursive=1" : ""}`),
      blob: (repo, sha) => githubFetch(`/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/git/blobs/${encodeURIComponent(sha)}`),
    });
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(cache), "utf8");
    await fs.rename(temporary, file);
    return summary;
  });
}
