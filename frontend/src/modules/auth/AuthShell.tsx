import React, { type ReactNode } from "react";
import { WorkstationIllustration } from "./WorkstationIllustration";

interface AuthShellProps {
  headline?: string;
  subcopy?: string;
  children: ReactNode;
}

export const AuthShell: React.FC<AuthShellProps> = ({
  headline = "Simplify\nmanagement with\nour dashboard",
  subcopy = "Simplify your workforce & talent operations with our user-friendly admin dashboard",
  children,
}) => {
  return (
    <div className="min-h-screen w-full bg-[#f1f3f7] flex items-center justify-center p-3 sm:p-6 lg:p-8 relative overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
      {/* Ambient Atmospheric Lighting (matching reference design) */}
      <div
        className="pointer-events-none absolute -top-28 -right-28 h-[460px] w-[460px] rounded-full bg-purple-400/20 blur-[110px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-28 -left-28 h-[420px] w-[420px] rounded-full bg-blue-300/25 blur-[120px]"
        aria-hidden="true"
      />
      {/* Subtle Dot Grid */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:28px_28px] opacity-40"
        aria-hidden="true"
      />

      {/* Main Elevated Modal Card */}
      <div className="relative z-10 w-full max-w-[1000px] rounded-[32px] bg-white p-4 sm:p-6 lg:p-7 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.10)] border border-slate-100 my-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          {/* Left Sub-Card: Vibrant Blue with 3D Workstation Illustration */}
          <aside
            className="hidden lg:flex lg:col-span-6 rounded-[26px] bg-gradient-to-b from-[#4068f6] via-[#385fed] to-[#284be3] p-8 lg:p-9 flex-col justify-between text-white relative overflow-hidden shadow-inner min-h-[580px]"
            aria-label="Portal Overview"
          >
            {/* Soft Internal Lighting */}
            <div
              className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-white/10 blur-2xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-indigo-950/30 blur-2xl"
              aria-hidden="true"
            />

            {/* Top Text */}
            <div className="relative z-10">
              <h2 className="text-3xl lg:text-[34px] font-extrabold tracking-tight text-white leading-[1.22]">
                {headline.split("\n").map((line, idx) => (
                  <React.Fragment key={idx}>
                    {line}
                    <br />
                  </React.Fragment>
                ))}
              </h2>
              <p className="mt-3.5 max-w-[320px] text-xs sm:text-sm font-normal text-blue-100/90 leading-relaxed">
                {subcopy}
              </p>
            </div>

            {/* Workstation 3D Character Illustration */}
            <div className="relative z-10 mt-auto pt-4 flex items-end justify-center">
              <WorkstationIllustration className="w-full h-auto max-h-[310px] drop-shadow-md" />
            </div>
          </aside>

          {/* Right Column: Form Container */}
          <main className="flex flex-col justify-center px-2 sm:px-6 lg:px-8 py-3 sm:py-6 lg:col-span-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
