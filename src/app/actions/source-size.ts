"use server";

import { updateSourceSize } from "../../lib/github/source-size";

export async function refreshSourceSize() {
  try { return { data: await updateSourceSize(), error: false as const }; }
  catch { return { data: null, error: true as const }; }
}
