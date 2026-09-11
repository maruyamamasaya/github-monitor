import type { CommitActivity, Repository } from "@/types/activity";

type GitHubRepository = Record<string, unknown> & { owner: { login: string } };
type GitHubCommit = Record<string, unknown> & { commit: { author: { date: string } | null; message: string }; stats?: { additions: number; deletions: number }; files?: unknown[] };

export function toRepository(raw: GitHubRepository): Repository {
  return {
    id: Number(raw.id), owner: raw.owner.login, name: String(raw.name), fullName: String(raw.full_name),
    private: Boolean(raw.private), url: String(raw.html_url), defaultBranch: String(raw.default_branch),
    updatedAt: String(raw.updated_at), pushedAt: raw.pushed_at ? String(raw.pushed_at) : null,
    language: raw.language ? String(raw.language) : null, archived: Boolean(raw.archived), fork: Boolean(raw.fork),
  };
}

export function toCommitActivity(raw: GitHubCommit, repository: string): CommitActivity {
  return {
    sha: String(raw.sha), repository, authoredAt: raw.commit.author?.date ?? new Date(0).toISOString(),
    message: raw.commit.message.split("\n")[0], additions: raw.stats?.additions ?? 0,
    deletions: raw.stats?.deletions ?? 0, changedFiles: raw.files?.length ?? 0, url: String(raw.html_url),
  };
}
