export default function Loading() {
  return <main className="shell"><div className="animate-pulse"><div className="mt-5 h-3 w-52 rounded bg-[var(--accent)]/20" /><div className="mt-5 h-12 w-96 max-w-full rounded bg-white/10" /><div className="mt-12 grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><div className="panel h-72" /><div className="panel h-72" /></div><div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">{Array.from({ length: 8 }, (_, i) => <div key={i} className="panel h-24" />)}</div></div></main>;
}
