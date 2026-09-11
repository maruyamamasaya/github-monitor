export const MAX_COMMIT_PAGES = 10;

export async function paginateCommits<T>(fetchPage: (page: number) => Promise<T[]>, perPage = 100): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= MAX_COMMIT_PAGES; page++) {
    const batch = await fetchPage(page);
    all.push(...batch);
    if (batch.length < perPage) break;
  }
  return all;
}
