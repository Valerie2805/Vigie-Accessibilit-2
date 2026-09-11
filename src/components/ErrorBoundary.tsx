import type { ReactNode } from 'react';
import { Component } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-ink text-ivory">
          <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
            <div className="rounded-[28px] border border-rose-300/20 bg-rose-300/10 p-6">
              <p className="text-xs uppercase tracking-[0.28em] text-rose-100">
                Erreur d'affichage
              </p>
              <h1 className="mt-4 font-display text-3xl text-ivory">
                Un probleme a provoque un ecran noir.
              </h1>
              <p className="mt-4 text-sm leading-7 text-ivory-muted">
                Recharge la page. Si le probleme revient en navigation normale mais pas en
                navigation privee, efface les donnees du site pour localhost.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-copper px-6 text-sm font-semibold text-ink transition hover:brightness-110"
              >
                Recharger
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
