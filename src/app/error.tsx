"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="shell grid min-h-screen place-items-center"><section className="panel max-w-lg p-10 text-center"><p className="eyebrow">Signal interrupted</p><h1 className="mt-4 text-3xl font-semibold tracking-[-.03em]">表示中に問題が発生しました</h1><button className="control mt-7 bg-[var(--accent)] text-black" onClick={reset}>もう一度試す</button></section></main>;
}
