import React, { type ReactNode } from "react";
import { WorkstationIllustration } from "./WorkstationIllustration";
import { CheckCircle2 } from "lucide-react";

interface AuthShellProps {
  headline?: string;
  accent?: string;
  subcopy?: string;
  features?: string[];
  children: ReactNode;
}

export const AuthShell: React.FC<AuthShellProps> = ({
  headline = "Smarter People.",
  accent = "Stronger Business.",
  subcopy = "A complete HRMS to manage your workforce, automate HR operations and build a productive, happy workplace.",
  features = [],
  children,
}) => {
  return (
    <div className="min-h-screen w-full bg-[var(--bg-page)] flex items-center justify-center p-6 max-[480px]:p-0 font-sans selection:bg-[#2F5FD0] selection:text-white">
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
          box-shadow: 0 0 0 1000px #ffffff inset !important;
          -webkit-text-fill-color: #111827 !important;
          caret-color: #111827 !important;
        }

        @media (max-width: 480px) {
          .login-card {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0px !important;
            background-color: transparent !important;
          }
        }
      `}</style>

      {/* Main Elevated Login Card */}
      <div className="login-card relative z-10 w-full max-w-[440px] lg:max-w-[960px] min-h-[560px] bg-white border border-[#E5E7EB] rounded shadow-kpi overflow-hidden my-auto flex flex-col lg:flex-row max-[480px]:border-0 max-[480px]:shadow-none max-[480px]:bg-transparent max-[480px]:min-h-0">
        {/* Left Brand Panel: Flat Solid Primary Blue, Flush against edges */}
        <aside
          className="hidden lg:flex lg:w-[45%] shrink-0 bg-[#2F5FD0] p-10 flex-col justify-between text-white relative"
          aria-label="Portal Overview"
        >
          {/* Top Text Content */}
          <div className="relative z-10">
            <h2 className="text-[28px] font-semibold tracking-tight text-white leading-[1.25]">
              {headline}
              {accent && (
                <>
                  <br />
                  <span className="text-white">{accent}</span>
                </>
              )}
            </h2>
            <p className="mt-3.5 max-w-[360px] text-sm font-normal text-white/90 leading-relaxed">
              {subcopy}
            </p>

            {features.length > 0 && (
              <ul className="mt-6 space-y-3">
                {features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-sm text-white font-normal">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Workstation 3D Character Illustration */}
          <div className="relative z-10 mt-auto pt-6 flex items-end justify-center">
            <WorkstationIllustration className="w-full max-w-[280px] h-auto drop-shadow-sm" />
          </div>
        </aside>

        {/* Right Form Column */}
        <main className="w-full lg:w-[55%] flex flex-col justify-center px-6 sm:px-12 py-10 sm:py-12 max-[480px]:px-4 max-[480px]:py-6">
          {children}
        </main>
      </div>
    </div>
  );
};
