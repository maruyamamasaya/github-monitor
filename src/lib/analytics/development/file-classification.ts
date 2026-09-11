import type { CommitFileDetail, FileCategory } from "@/types/activity";

export const MEANINGFUL_LOC_EXCLUSIONS = [
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/i,
  /(^|\/)(vendor|vendors|third_party|node_modules|dist|build|coverage)\//i,
  /\.(min\.(js|css)|map)$/i,
  /(^|\/)(generated|__generated__)\//i,
  /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|mp[34]|mov)$/i,
] as const;

const TEST_PATH = /(^|\/)(__tests__|tests?|specs?)\//i;
const TEST_NAME = /(^|\.)((test|spec))\.[^.]+$/i;
const XCODE_TEST = /Tests?\/(?:.*\.)?swift$/i;
const DOC_PATH = /(^|\/)(docs?|documentation|adr|decisions)\//i;
const DOC_NAME = /(^|\/)(readme|changelog|contributing|license)(\.|$)/i;
const CONFIG_NAME = /(^|\/)(\.env(?:\..*)?\.example|tsconfig(?:\..*)?\.json|eslint\.config\.|next\.config\.|vite\.config\.|dockerfile|makefile)/i;
const CONFIG_EXT = /\.(json|ya?ml|toml|ini|conf|config|properties)$/i;
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|swift|py|java|go|rs|cpp|cc|cxx|c|h|hpp|cs|kt|kts|rb|php|scala|vue|svelte|sh|sql)$/i;

export function isMeaningfulFile(filename: string): boolean {
  return !MEANINGFUL_LOC_EXCLUSIONS.some((pattern) => pattern.test(filename.replaceAll("\\", "/")));
}

export function classifyFile(filename: string): FileCategory {
  const normalized = filename.replaceAll("\\", "/");
  const basename = normalized.split("/").at(-1) ?? normalized;
  if (TEST_PATH.test(normalized) || TEST_NAME.test(basename) || XCODE_TEST.test(normalized)) return "test";
  if (DOC_PATH.test(normalized) || DOC_NAME.test(normalized) || /\.mdx?$/i.test(normalized)) return "docs";
  if (CONFIG_NAME.test(normalized) || CONFIG_EXT.test(normalized)) return "config";
  if (CODE_EXT.test(normalized)) return "code";
  return "other";
}

export function fileChangedLines(file: CommitFileDetail): number {
  return file.additions + file.deletions;
}
