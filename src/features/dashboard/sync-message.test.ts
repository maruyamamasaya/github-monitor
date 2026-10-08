import { expect, it } from "vitest";
import { describeSyncStatus } from "./sync-message";
it("allows budget continuation but advises waiting for GitHub restrictions",()=>{
 const base={pendingRepositories:17,detailFailures:0};
 const budget=describeSyncStatus({...base,pauseReason:"budget"},"ja");
 expect(budget.retry).toBe(true); expect(budget.explanation).toContain("17"); expect(budget.action).toContain("待つ必要はありません");
 for(const pauseReason of ["quota","rate-limit"] as const)expect(describeSyncStatus({...base,pauseReason},"ja").retry).toBe(false);
 expect(describeSyncStatus({...base,pauseReason:null,detailFailures:1},"ja").title).toContain("取得できませんでした");
});
