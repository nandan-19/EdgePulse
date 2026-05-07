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
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-blue-600" />
          <span className="font-bold text-lg text-slate-800 tracking-tight">EdgePulse</span>
          <span className="text-slate-500 text-sm hidden sm:block">/ Clinical Telemetry</span>
        </div>
        <nav className="flex items-center gap-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${path === href
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          System Live
        </div>
      </div>
    </header>
  );
}
