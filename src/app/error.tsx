"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="shell min-h-screen grid place-items-center"><section className="panel p-8 text-center"><p className="eyebrow">Unexpected error</p><h1 className="mt-3 text-2xl">表示中に問題が発生しました</h1><button className="mt-6 rounded-md bg-[#238636] px-4 py-2 font-semibold" onClick={reset}>もう一度試す</button></section></main>;
}
