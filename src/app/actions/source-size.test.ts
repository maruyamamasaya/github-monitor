import { expect, it, vi } from "vitest";
const update = vi.hoisted(() => vi.fn());
vi.mock("../../lib/github/source-size", () => ({ updateSourceSize: update }));
import { refreshSourceSize } from "./source-size";

it("returns only source-size results and converts exceptions to a safe response", async () => {
  update.mockResolvedValueOnce({ complete: true });
  expect(await refreshSourceSize()).toEqual({ data: { complete: true }, error: false });
  update.mockRejectedValueOnce(new Error("private upstream details"));
  expect(await refreshSourceSize()).toEqual({ data: null, error: true });
});
