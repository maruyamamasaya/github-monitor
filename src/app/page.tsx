import { Dashboard } from "@/features/dashboard/dashboard";
import { loadDashboard } from "@/lib/github/dashboard";
import { GitHubApiError } from "@/lib/github/client";
import type { PeriodKey } from "@/types/activity";
import { buildCodeScope } from "@/lib/analytics/code-scope";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ period?: string; scope?: string; branches?: string }> }) {
  const params = await searchParams;
  const selectedPeriod = params.period;
  const branchScope = params.branches === "all" ? "all" : "default";
  const period: PeriodKey = selectedPeriod === "today" || selectedPeriod === "week" || selectedPeriod === "quarter" ? selectedPeriod : "month";
  let data;
  let loadError: unknown;
  try {
    data = await loadDashboard(branchScope);
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
  const codeScope = buildCodeScope(data.repositories, new Date(data.generatedAt));
  const clientCodeScope = { ...codeScope, repositories: codeScope.repositories.map((item) => ({ ...item, commits: [] })) };
  return <Dashboard data={clientData} codeData={clientCodeScope} initialPeriod={period} initialScope={params.scope === "code" ? "code" : "all"} branchScope={branchScope} />;
}
