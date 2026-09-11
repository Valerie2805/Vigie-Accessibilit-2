import { Building2, History, Radar, Search, ShieldAlert, Target } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

const navigation = [
  { to: '/', label: 'Recherche', icon: Search },
  { to: '/opportunites', label: 'Opportunites', icon: Target },
  { to: '/historique', label: 'Historique', icon: History },
];

type AppShellProps = {
  title: string;
  eyebrow: string;
  description: string;
  children: ReactNode;
};

export function AppShell({ title, eyebrow, description, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-ink text-ivory">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 lg:px-8">
        <header className="mb-8 grid gap-6 rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-panel backdrop-blur md:grid-cols-[280px,1fr]">
          <div className="rounded-[24px] border border-copper/30 bg-copper/8 p-5">
            <div className="mb-8 flex items-center gap-3 text-copper">
              <div className="rounded-full border border-copper/40 bg-copper/10 p-2">
                <Radar className="h-5 w-5" />
              </div>
              <span className="font-sans text-xs uppercase tracking-[0.28em] text-copper-soft">
                Vigie Accessibilite
              </span>
            </div>

            <div className="space-y-3">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition-all',
                        isActive
                          ? 'border-copper/40 bg-copper text-ink'
                          : 'border-white/10 bg-white/5 text-ivory-muted hover:border-copper/40 hover:bg-white/10 hover:text-ivory',
                      )
                    }
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    <ShieldAlert className="h-4 w-4 opacity-60" />
                  </NavLink>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-[24px] border border-white/10 bg-gradient-to-br from-white/8 via-white/5 to-transparent p-6">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-moss">
              <Building2 className="h-4 w-4" />
              {eyebrow}
            </div>

            <div className="mt-8 max-w-3xl space-y-4">
              <h1 className="font-display text-4xl leading-none text-ivory sm:text-5xl">
                {title}
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-ivory-muted sm:text-base">
                {description}
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
