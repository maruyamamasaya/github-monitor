export default function Loading() {
  return <main className="shell"><div className="animate-pulse"><div className="h-8 w-56 rounded bg-white/10" /><div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="panel h-28" />)}</div><div className="panel mt-4 h-80" /></div></main>;
}
