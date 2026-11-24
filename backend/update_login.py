import re

with open('frontend/src/modules/auth/Login.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = '{!isForgotPassword ? ('
end_marker = ') : ('

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx == -1 or end_idx == -1:
    print('Markers not found!')
    exit(1)

new_block = '''{!isForgotPassword ? (
        /* ------------------------------------------------------------- */
        /* Exact Reference Layout: Welcome Back Login Form               */
        /* ------------------------------------------------------------- */
        <div className="w-full max-w-[360px] sm:max-w-[400px] mx-auto flex flex-col justify-center px-4 sm:px-6">
          {/* Top Brand Logo & Wordmark (Matching Reference Image) */}
          <div className="flex items-center gap-3 mb-6">
            <svg
              className="h-8 w-auto shrink-0 select-none drop-shadow-xs"
              viewBox="0 0 100 42"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="PeopleSync Brand Mark"
            >
              <defs>
                <linearGradient id="psOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ea580c" />
                </linearGradient>
                <linearGradient id="psBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
              </defs>
              {/* Left head */}
              <circle cx="28" cy="11" r="5" fill="url(#psOrangeGrad)" />
              {/* Right head */}
              <circle cx="72" cy="11" r="5" fill="url(#psBlueGrad)" />
              {/* Infinity loop body */}
              <path
                d="M28 20 C14 20 10 32 24 38 C36 43 46 28 50 24 C54 28 64 43 76 38 C90 32 86 20 72 20 C60 20 52 32 50 32 C48 32 40 20 28 20 Z"
                stroke="url(#psBlueGrad)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M28 20 C18 20 12 28 20 34 C28 40 40 28 50 24"
                stroke="url(#psOrangeGrad)"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-[26px] font-bold tracking-tight text-[#0f172a] font-manrope">
              People<span className="text-[#2563eb]">Sync</span>
            </span>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-[28px] sm:text-[30px] font-extrabold tracking-tight text-[#0f172a] leading-tight font-manrope">
              Welcome Back
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-400 font-normal">
              Please login to your account
            </p>
          </div>

          {/* Success Message Banner */}
          {successMessage && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 text-xs font-medium text-emerald-800"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Message Banner */}
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/90 p-3 text-xs font-medium text-red-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Field with Floating Badges */}
            <div className="relative flex items-center">
              {/* Left Blue Status Dot/Check */}
              <div
                className="absolute -left-7 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-[#3b82f6] text-white shadow-xs ring-2 ring-white select-none"
                aria-hidden="true"
              >
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2.5 6 5 8.5 9.5 3.5" />
                </svg>
              </div>

              <label htmlFor="login-email" className="sr-only">
                Work email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                disabled={isLoading}
                autoFocus
                className="w-full rounded-2xl bg-[#edf2f8] border border-slate-200/70 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] px-5 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#3b82f6] focus:ring-4 focus:ring-blue-500/10 transition-all outline-none disabled:opacity-60"
              />

              {/* Right Green Status Dot/Check */}
              <div
                className="absolute -right-7 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-[#22c55e] text-white shadow-xs ring-2 ring-white select-none"
                aria-hidden="true"
              >
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2.5 6 5 8.5 9.5 3.5" />
                </svg>
              </div>
            </div>

            {/* Password Field with Floating Badges */}
            <div className="space-y-1.5">
              <div className="relative flex items-center">
                {/* Left Blue Status Dot/Check */}
                <div
                  className="absolute -left-7 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-[#3b82f6] text-white shadow-xs ring-2 ring-white select-none"
                  aria-hidden="true"
                >
                  <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2.5 6 5 8.5 9.5 3.5" />
                  </svg>
                </div>

                <label htmlFor="login-password" className="sr-only">
                  Password
                </label>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="w-full rounded-2xl bg-[#edf2f8] border border-slate-200/70 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] pl-5 pr-11 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#3b82f6] focus:ring-4 focus:ring-blue-500/10 transition-all outline-none disabled:opacity-60"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>

                {/* Right Soft Indicator Badge */}
                <div
                  className="absolute -right-7 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-[#fef08a] text-[#854d0e] shadow-xs ring-2 ring-white select-none"
                  aria-hidden="true"
                >
                  <ShieldCheck className="h-3 w-3" />
                </div>
              </div>

              {/* Forgot Password Link (Right Aligned under Password) */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleForgotPasswordStart}
                  className="text-xs text-[#3b82f6] hover:text-[#1d4ed8] font-semibold transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            {/* Login Action Button */}
            <div className="relative group pt-1">
              <button
                type="submit"
                disabled={isLoading}
                className="relative w-full rounded-2xl bg-gradient-to-r from-[#1d63ea] via-[#3575f6] to-[#2563eb] hover:from-[#1a5ce0] hover:via-[#2f6ff5] hover:to-[#1d4ed8] py-3.5 text-base font-semibold text-white shadow-[0_10px_25px_-5px_rgba(37,99,235,0.4)] transition-all duration-200 active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 overflow-hidden"
              >
                {/* Iridescent shimmer highlight */}
                <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
                {isLoading ? (
                  <>
                    <svg
                      className="h-5 w-5 animate-spin text-white icon-on-primary"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Logging in...</span>
                  </>
                ) : (
                  <span>Login</span>
                )}
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-xs leading-5 text-slate-400">
            Secure access for authorized PeopleSync employees and administrators.
          </p>
        </div>
      '''

updated = content[:start_idx] + new_block + content[end_idx:]
with open('frontend/src/modules/auth/Login.tsx', 'w', encoding='utf-8') as f:
    f.write(updated)

print('Login.tsx successfully updated!')
