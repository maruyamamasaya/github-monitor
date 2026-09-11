import { describe, expect, it, vi } from "vitest";
import { paginateCommits } from "./pagination";

describe("commit pagination",()=>{
  it("continues full pages and stops on a short page",async()=>{const fetchPage=vi.fn(async(page:number)=>page===1?Array.from({length:100},(_,i)=>i):[100]);const result=await paginateCommits(fetchPage);expect(result).toHaveLength(101);expect(fetchPage).toHaveBeenCalledTimes(2)});
  it("stops immediately for an empty repository",async()=>{const fetchPage=vi.fn(async()=>[]);expect(await paginateCommits(fetchPage)).toEqual([]);expect(fetchPage).toHaveBeenCalledTimes(1)});
});
