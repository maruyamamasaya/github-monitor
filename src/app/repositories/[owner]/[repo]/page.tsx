import { notFound } from "next/navigation";
import { RepositoryDetail } from "@/features/dashboard/repository-detail";
import { loadDashboard } from "@/lib/github/dashboard";

export default async function RepositoryPage({ params, searchParams }: { params: Promise<{ owner: string; repo: string }>; searchParams: Promise<{ branches?: string }> }) {
  const { owner, repo } = await params;
  const branchScope = (await searchParams).branches === "all" ? "all" : "default";
  const data = await loadDashboard(branchScope);
  const item = data.repositories.find((entry) => entry.repository.owner.toLowerCase() === owner.toLowerCase() && entry.repository.name.toLowerCase() === repo.toLowerCase());
  if (!item) notFound();

  return <RepositoryDetail item={item} branchScope={branchScope} warnings={data.warnings} />;
}
