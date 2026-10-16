import React, { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  Loader,
  HeartPulse,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Head from "next/head";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      toast.error("Please fill in all fields.");
      return;
    }

    try {
      setIsSubmitting(true);
      await signIn(email.trim(), password);

      toast.success("Logged in successfully! Redirecting to Home...");
      await router.push("/home");
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Login failed. Please try again.";

      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>SymptomSync | Log In</title>
        <meta
          name="description"
          content="Log in to your SymptomSync account to track and manage your health."
        />
      </Head>

      <main
        className={`${inter.className} min-h-screen bg-[#f7f8f8] text-[#27333b]`}
      >
        <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-6 sm:px-10 lg:px-16">
          {/* Header */}
          <header className="flex items-center justify-between py-6 sm:py-8">
            <Link
              href="/"
              className="inline-flex items-center gap-3"
              aria-label="SymptomSync home"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#405f73] text-white shadow-sm">
                <HeartPulse size={23} strokeWidth={1.8} />
              </span>

              <span className="text-xl font-semibold tracking-[-0.8px] sm:text-2xl">
                Symptom
                <span className="text-[#718b9b]">Sync</span>
              </span>
            </Link>

            <p className="hidden text-sm text-[#69747b] sm:block">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/signUp"
                className="font-semibold text-[#405f73] transition-colors hover:text-[#324e60]"
              >
                Sign up
              </Link>
            </p>

            <Link
              href="/auth/signUp"
              className="text-sm font-semibold text-[#405f73] transition-colors hover:text-[#324e60] sm:hidden"
            >
              Sign up
            </Link>
          </header>

          {/* Login form */}
          <div className="flex flex-1 flex-col items-center justify-center py-10 sm:py-0 lg:pb-10">
            <div className="w-full max-w-[440px]">
              {/* Back button */}
              <Link
                href="/"
                className="mb-8 inline-flex items-center gap-2 text-sm text-[#69747b] transition-colors hover:text-[#405f73]"
              >
                <ArrowLeft size={16} />
                Back
              </Link>

              <div className="rounded-[28px] border border-[#e4e8e9] bg-white p-6 shadow-[0_12px_45px_rgba(39,51,59,0.045)] sm:p-9">
                <div className="mb-8">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[2px] text-[#718b9b]">
                    Welcome back
                  </p>

                  <h1 className="text-3xl font-semibold tracking-[-1.2px]">
                    Log in to SymptomSync
                  </h1>

                  <p className="mt-3 text-sm leading-6 text-[#69747b]">
                    Pick up where you left off.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Email */}
                  <div>
                    <label
                      htmlFor="login-email"
                      className="mb-2 block text-sm font-medium text-[#35434c]"
                    >
                      Email address
                    </label>

                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 w-full rounded-xl border-[#dce2e5] bg-[#fcfcfc] px-4 text-sm text-[#27333b] placeholder:text-[#9aa3a8] focus-visible:border-[#718b9b] focus-visible:ring-2 focus-visible:ring-[#718b9b]/20"
                      required
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label
                        htmlFor="login-password"
                        className="block text-sm font-medium text-[#35434c]"
                      >
                        Password
                      </label>

                      <Link
                        href="/auth/forgotPassword"
                        className="text-xs font-medium text-[#587587] transition-colors hover:text-[#324e60] hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>

                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-12 w-full rounded-xl border-[#dce2e5] bg-[#fcfcfc] px-4 pr-12 text-sm text-[#27333b] placeholder:text-[#9aa3a8] focus-visible:border-[#718b9b] focus-visible:ring-2 focus-visible:ring-[#718b9b]/20"
                        required
                      />

                      <button
                        type="button"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#89949a] transition-colors hover:text-[#405f73] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#718b9b]"
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    aria-label="Log in"
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#405f73] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#324e60] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting && (
                      <Loader size={17} className="animate-spin" />
                    )}
                    {isSubmitting ? "Logging in..." : "Log in"}
                  </Button>
                </form>

                <p className="mt-6 text-center text-xs leading-6 text-[#89949a]">
                  By logging in, you agree to our{" "}
                  <Link
                    href="/terms"
                    className="text-[#587587] underline decoration-[#c7d3da] underline-offset-2 transition-colors hover:text-[#324e60]"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    className="text-[#587587] underline decoration-[#c7d3da] underline-offset-2 transition-colors hover:text-[#324e60]"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="flex flex-col items-center justify-between gap-3 border-t border-[#e4e8e9] py-5 text-xs text-[#89949a] sm:flex-row">
            <p>© {new Date().getFullYear()} SymptomSync</p>

            <Link
              href="/"
              className="transition-colors hover:text-[#405f73]"
            >
              SymptomSync
            </Link>
          </footer>
        </div>
      </main>
    </>
  );
}