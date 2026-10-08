import type { BranchScope, Repository } from "@/types/activity";
import type { CommitSummary, ListContext } from "./incremental-sync";
import { MAX_COMMIT_PAGES } from "./pagination";

type Branch = { name: string; commit: { sha: string } };
type RawSummary = CommitSummary & { commit?: { author?: { date: string } | null } };
type FetchJson = <T>(path: string) => Promise<T>;

// Each request is reserved before dispatch, including pagination and failed requests.
export async function listBranchCommits(repo: Repository, username: string | string[], since: string, scope: BranchScope, fetchJson: FetchJson, context: ListContext) {
  const base = `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`;
  let requests = 0;
  let complete = true;
  const items = new Map<string, CommitSummary>();
  const request = async <T>(path: string): Promise<T | null> => {
    if (!context.reserveRequest()) { complete = false; return null; }
    requests++;
    return fetchJson<T>(path);
  };
  const authors = [...new Set(typeof username === "string" ? [username] : username)];
  const branches: Branch[] = [];
  if (scope === "all") {
    for (let page = 1; ; page++) {
      const batch = await request<Branch[]>(`${base}/branches?per_page=100&page=${page}`);
      if (!batch) break;
      branches.push(...batch);
      if (batch.length < 100) break;
    }
    // Scan the default branch first and skip identical tips to avoid duplicate walks.
    branches.sort((a, b) => Number(b.name === repo.defaultBranch) - Number(a.name === repo.defaultBranch));
  }
  const refs = scope === "all" ? [...new Set(branches.map((branch) => branch.commit.sha))] : [repo.defaultBranch];
  if (scope === "all" && complete && context.branchHeads) {
    const reachable = new Set(refs);
    for (const ref of Object.keys(context.branchHeads)) if (!reachable.has(ref)) delete context.branchHeads[ref];
  }
  for (const ref of refs) {
    const cached = scope === "all" ? context.branchHeads?.[ref] : undefined;
    if (cached && cached.since <= since) {
      for (const item of cached.items) {
        if (item.authoredAt && item.authoredAt < since) continue;
        if (!items.has(item.sha) && items.size >= 1000) { complete = false; break; }
        items.set(item.sha, item);
      }
      if (items.size >= 1000) { complete = false; break; }
      continue;
    }
    const headItems: CommitSummary[] = [];
    let headComplete = true;
    for (const author of authors) {
      let authorComplete = false;
      for (let page = 1; page <= MAX_COMMIT_PAGES; page++) {
        const batch = await request<RawSummary[]>(`${base}/commits?author=${encodeURIComponent(author)}&since=${encodeURIComponent(since)}&sha=${encodeURIComponent(ref)}&per_page=100&page=${page}`);
        if (!batch) break;
        for (const item of batch) {
          const authoredAt = item.commit?.author?.date;
          const summary = authoredAt ? { sha: item.sha, authoredAt } : { sha: item.sha };
          headItems.push(summary);
          if (!items.has(item.sha) && items.size >= 1000) { complete = false; break; }
          items.set(item.sha, summary);
        }
        if (batch.length < 100 && items.size < 1000) { authorComplete = true; break; }
        if (page === MAX_COMMIT_PAGES) complete = false;
        if (items.size >= 1000) { complete = false; break; }
      }
      if (!authorComplete) { headComplete = false; complete = false; break; }
    }
    if (scope === "all" && headComplete && context.branchHeads) context.branchHeads[ref] = { since, items: headItems };
    if (items.size >= 1000) break;
  }
  return { items: [...items.values()], requests, complete };
}
