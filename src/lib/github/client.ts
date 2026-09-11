import "server-only";

const API_URL = "https://api.github.com";

export class GitHubApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "GitHubApiError"; }
}

export function getGitHubConfig() {
  const token = process.env.GITHUB_TOKEN?.trim();
  const username = process.env.GITHUB_USERNAME?.trim();
  if (!token || !username) throw new GitHubApiError(0, "GitHubの接続設定がありません。");
  return { token, username };
}

export async function githubFetch<T>(path: string, revalidate: number | false = false): Promise<T> {
  const { token } = getGitHubConfig();
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" },
    ...(revalidate === false ? { cache: "no-store" as const } : { next: { revalidate } }),
  });
  if (!response.ok) {
    const safeMessage = response.status === 401 ? "GitHub tokenを確認してください。" : `GitHub API request failed (${response.status})`;
    throw new GitHubApiError(response.status, safeMessage);
  }
  return response.json() as Promise<T>;
}

export async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = { status: "fulfilled", value: await task(items[index]) }; }
      catch (reason) { results[index] = { status: "rejected", reason }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
