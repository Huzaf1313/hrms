import React, { type ReactNode } from "react";

interface AuthShellProps {
  headline: string;
  accent: string;
  subcopy: string;
  features: string[];
  children: ReactNode;
}

export const AuthShell: React.FC<AuthShellProps> = ({
  headline,
  accent,
  subcopy,
  features,
  children,
}) => {
  return (
    <div className="min-h-dvh w-full bg-surface-muted antialiased text-ink-900">
      <div className="grid min-h-dvh w-full lg:grid-cols-12">
        {/* Left Section: Brand Panel (hidden below lg) */}
        <aside
          className="auth-brand-panel relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-panel-900 via-panel-800 to-[#0c1424] p-10 text-white lg:col-span-5 lg:flex xl:col-span-6 xl:p-14"
          aria-label="Brand Overview"
        >
          {/* Subtle Aurora Lighting Effect */}
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden"
            aria-hidden="true"
          >
            <div className="auth-aurora-1 absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand-600/25 blur-3xl" />
            <div className="auth-aurora-2 absolute -bottom-28 -right-28 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
          </div>

          {/* Brand Header */}
          <div className="relative z-10 flex items-center gap-3">
            <img
              src="/aarmarks-logo.png"
              alt="AarMarks Logo"
              className="h-11 w-11 rounded-xl bg-white/10 p-1.5 object-contain backdrop-blur-sm"
            />
            <div>
              <span className="brand-wordmark block text-xl font-bold tracking-tight text-white">
                AarMarks HRMS
              </span>
              <span className="block text-xs font-medium tracking-wide text-ink-300">
                Workforce Intelligence System
              </span>
            </div>
          </div>

          {/* Central Hero Copy & Feature Chips */}
          <div className="relative z-10 my-auto py-12">
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-[40px]">
              {headline} <span className="text-brand-500">{accent}</span>
            </h2>

            <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-300 sm:text-base">
              {subcopy}
            </p>

            {/* Feature Chips */}
            <div className="mt-8 grid grid-cols-2 gap-3">
              {features.map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 backdrop-blur-sm transition-colors hover:bg-white/[0.08]"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
                    aria-hidden="true"
                  />
                  <span className="text-xs font-medium text-slate-200">
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Metadata */}
          <div className="relative z-10 flex items-center justify-between text-xs text-ink-400">
            <span>&copy; {new Date().getFullYear()} AarMarks Media Pvt. Ltd.</span>
            <span className="flex items-center gap-1.5 text-ink-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Enterprise Secure
            </span>
          </div>
        </aside>

        {/* Right Section: Form Container */}
        <main className="flex flex-col items-center justify-center p-3 sm:p-5 lg:col-span-7 lg:p-6 xl:col-span-6 xl:p-8">
          {/* Mobile Logo & Wordmark (hidden lg and up) */}
          <div className="mb-3 flex flex-col items-center text-center sm:mb-4 lg:hidden">
            <img
              src="/aarmarks-logo.png"
              alt="AarMarks Logo"
              className="h-12 w-12 object-contain"
            />
            <span className="brand-wordmark mt-2 text-xl font-bold tracking-tight text-ink-900">
              AarMarks HRMS
            </span>
            <span className="text-xs text-ink-600">
              Human Resource Management System
            </span>
          </div>

          {/* Form Card (Max width ~28rem / 448px, animated with auth-rise) */}
          <div className="auth-rise w-full max-w-[28rem] rounded-2xl border border-line bg-surface p-5 shadow-xl shadow-ink-900/5 sm:p-6 lg:p-7">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
