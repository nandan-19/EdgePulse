'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, GitBranch } from 'lucide-react';

export default function Navbar() {
  const path = usePathname();
  const nav = [
    { href: '/', label: 'Clinical Monitor', icon: Activity },
    { href: '/analyze', label: 'Pipeline Flow', icon: GitBranch },
  ];
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💓</span>
          <span className="font-bold text-lg text-white tracking-tight">EdgePulse</span>
          <span className="text-slate-500 text-sm hidden sm:block">/ Real-Time Telemetry</span>
        </div>
        <nav className="flex items-center gap-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${path === href
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </div>
      </div>
    </header>
  );
}
