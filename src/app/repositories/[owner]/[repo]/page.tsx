import { notFound } from "next/navigation";
import { RepositoryDetail } from "@/features/dashboard/repository-detail";
import { loadDashboard } from "@/lib/github/dashboard";

export default async function RepositoryPage({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  const data = await loadDashboard();
  const item = data.repositories.find((entry) => entry.repository.owner.toLowerCase() === owner.toLowerCase() && entry.repository.name.toLowerCase() === repo.toLowerCase());
  if (!item) notFound();

  return <RepositoryDetail item={item} />;
}
