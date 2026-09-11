import Link from "next/link";
export default function NotFound() { return <main className="shell min-h-screen grid place-items-center"><section className="panel p-8 text-center"><p className="eyebrow">404</p><h1 className="mt-3 text-2xl">Repositoryが見つかりません</h1><Link className="mt-6 inline-block text-[var(--green)]" href="/">Dashboardへ戻る →</Link></section></main>; }
