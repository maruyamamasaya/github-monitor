import { expect, it } from "vitest";
import { resolveAuthors } from "./authors";
it("includes the primary author and normalizes duplicate additional accounts", () => {
 expect(resolveAuthors("MaruyamaMasaya", " xsbyl101, MARUYAMAMASAYA, xsbyl101, ")).toEqual(["maruyamamasaya", "xsbyl101"]);
 expect(resolveAuthors("octo")).toEqual(["octo"]);
});
