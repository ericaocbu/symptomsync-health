import React, { useState } from "react";
import Link from "next/link";
import {
  Loader,
  HeartPulse,
  ArrowLeft,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Head from "next/head";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Please enter your email.");
      return;
    }

    try {
      setIsSubmitting(true);

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/auth/updatePassword`,
        }
      );

      if (error) throw error;

      setIsSent(true);
      toast.success("Reset link sent! Check your email.");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to send reset link."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>SymptomSync | Forgot Password</title>
        <meta
          name="description"
          content="Reset your password to access your SymptomSync account."
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
          </header>

          {/* Reset password form */}
          <div className="flex flex-1 flex-col items-center justify-center py-10 sm:py-0 lg:pb-10">
            <div className="w-full max-w-[440px]">
              <Link
                href="/auth/login"
                className="mb-8 inline-flex items-center gap-2 text-sm text-[#69747b] transition-colors hover:text-[#405f73]"
              >
                <ArrowLeft size={16} />
                Back
              </Link>

              <div className="rounded-[28px] border border-[#e4e8e9] bg-white p-6 shadow-[0_12px_45px_rgba(39,51,59,0.045)] sm:p-9">
                <div className="mb-8">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#dce4e8] bg-[#e6edf2] text-[#405f73]">
                    <Mail size={25} strokeWidth={1.7} />
                  </div>

                  <p className="mb-3 text-xs font-semibold uppercase tracking-[2px] text-[#718b9b]">
                    Account recovery
                  </p>

                  <h1 className="text-3xl font-semibold tracking-[-1.2px]">
                    Forgot your password?
                  </h1>

                  <p className="mt-3 text-sm leading-6 text-[#69747b]">
                    No worries. Enter the email address associated with your
                    account, and we&apos;ll send you a link to reset your
                    password.
                  </p>
                </div>

                {isSent ? (
                  <div
                    role="status"
                    className="rounded-2xl border border-[#dce4e8] bg-[#f4f7f8] p-5"
                  >
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#405f73]">
                      <Mail size={18} />
                      Check your inbox
                    </div>

                    <p className="text-sm leading-6 text-[#69747b]">
                      If an account exists for{" "}
                      <span className="font-medium text-[#35434c]">
                        {email.trim()}
                      </span>
                      , you should receive a password reset link shortly.
                      Check your spam folder if it doesn&apos;t arrive.
                    </p>

                    <button
                      type="button"
                      onClick={() => setIsSent(false)}
                      className="mt-4 text-sm font-semibold text-[#587587] underline underline-offset-4 transition-colors hover:text-[#324e60]"
                    >
                      Try another email
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleReset} className="space-y-5">
                    <div>
                      <label
                        htmlFor="reset-email"
                        className="mb-2 block text-sm font-medium text-[#35434c]"
                      >
                        Email address
                      </label>

                      <Input
                        id="reset-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 w-full rounded-xl border-[#dce2e5] bg-[#fcfcfc] px-4 text-sm text-[#27333b] placeholder:text-[#9aa3a8] focus-visible:border-[#718b9b] focus-visible:ring-2 focus-visible:ring-[#718b9b]/20"
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#405f73] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#324e60] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting && (
                        <Loader size={17} className="animate-spin" />
                      )}
                      {isSubmitting ? "Sending link..." : "Send reset link"}
                    </Button>
                  </form>
                )}

                <p className="mt-6 text-center text-sm text-[#69747b]">
                  Remember your password?{" "}
                  <Link
                    href="/auth/login"
                    className="font-semibold text-[#587587] transition-colors hover:text-[#324e60]"
                  >
                    Log in
                  </Link>
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