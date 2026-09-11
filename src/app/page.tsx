import { Dashboard } from "@/features/dashboard/dashboard";
import { loadDashboard } from "@/lib/github/dashboard";
import { GitHubApiError } from "@/lib/github/client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let data;
  let loadError: unknown;
  try {
    data = await loadDashboard();
  } catch (error) {
    loadError = error;
  }
  if (!data) {
    const missing = loadError instanceof GitHubApiError && loadError.status === 0;
    return (
      <main className="shell min-h-screen grid place-items-center">
        <section className="panel max-w-2xl p-8">
          <p className="eyebrow">Connection required</p>
          <h1 className="mt-3 text-3xl font-semibold">{missing ? "GitHubを接続してください" : "GitHubのデータを取得できませんでした"}</h1>
          <p className="muted mt-4 leading-7">{loadError instanceof Error ? loadError.message : "予期しないエラーが発生しました。"}</p>
          <div className="mt-6 rounded-lg border border-[var(--line)] bg-black/25 p-4 text-sm leading-7">
            <code>cp .env.example .env.local</code><br />
            <code>GITHUB_TOKEN=github_pat_...</code><br />
            <code>GITHUB_USERNAME=maruyamamasaya</code>
          </div>
        </section>
      </main>
    );
  }
  const clientData = {
    ...data,
    repositories: data.repositories.map((item) => ({ ...item, commits: [] })),
  };
  return <Dashboard data={clientData} />;
}
