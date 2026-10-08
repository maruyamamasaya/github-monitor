export function resolveAuthors(username: string, configured = ""): string[] {
  return [...new Set([username, ...configured.split(",")].map(value => value.trim().toLowerCase()).filter(Boolean))].sort();
}
