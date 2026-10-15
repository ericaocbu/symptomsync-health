import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import { Inter } from "next/font/google";
import Link from "next/link";
import Head from "next/head";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Heart,
  HeartPulse,
  Menu,
  Pill,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const appHref = user ? "/home" : "/auth/login";
  const signupHref = user ? "/home" : "/auth/signUp";

  const features = [
    {
      icon: Activity,
      title: "Track how you feel",
      description:
        "Keep symptoms and daily health metrics organized in one place.",
      color: "bg-[#e6edf2] text-[#58778e]",
    },
    {
      icon: TrendingUp,
      title: "Notice your patterns",
      description:
        "Review your health history and see how your symptoms change over time.",
      color: "bg-[#e9ebf2] text-[#6b7898]",
    },
    {
      icon: Pill,
      title: "Stay on schedule",
      description:
        "Keep medication routines and health reminders easier to manage.",
      color: "bg-[#f1ece5] text-[#927d66]",
    },
  ];

  const faqs = [
    {
      question: "What is SymptomSync?",
      answer:
        "SymptomSync is a health tracking app designed to help you organize your health information, record symptoms, and review your progress over time.",
    },
    {
      question: "How do I get started?",
      answer:
        "Create an account to get started. Once you're signed in, explore the available tools and begin recording your health information.",
    },
    {
      question: "Can I review my health history?",
      answer:
        "SymptomSync helps you keep track of health information over time. Available tracking and reporting features depend on the tools enabled in your account.",
    },
    {
      question: "Is SymptomSync a replacement for medical care?",
      answer:
        "No. SymptomSync is a tracking tool, not a diagnostic service. It does not replace advice from a qualified healthcare professional.",
    },
  ];

  return (
    <>
      <Head>
        <title>SymptomSync — Your health, in perspective</title>
        <meta
          name="description"
          content="Keep your symptoms, health history, and daily wellness tracking organized with SymptomSync."
        />
        <meta name="theme-color" content="#f7f8f8" />
      </Head>

      <div
        className={`${inter.className} min-h-screen overflow-x-hidden bg-[#f7f8f8] text-[#27333b]`}
      >
        <style jsx global>{`
          html {
            scroll-behavior: smooth;
            scroll-padding-top: 100px;
          }

          body {
            margin: 0;
          }

          ::selection {
            background: #dce6ec;
            color: #293f4d;
          }
        `}</style>

        {/* Navigation */}
        <header className="sticky top-0 z-50 border-b border-[#e4e8e9] bg-[#f7f8f8]/95 backdrop-blur-xl">
          <nav className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
            <Link
              href="/"
              className="flex items-center gap-3"
              aria-label="SymptomSync home"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#405f73] text-white">
                <HeartPulse size={22} strokeWidth={1.8} />
              </span>
              <span className="text-xl font-bold tracking-tight">
                Symptom<span className="text-[#718b9b]">Sync</span>
              </span>
            </Link>

            <div className="hidden items-center gap-9 md:flex">
              <Link
                href="#features"
                className="text-sm font-medium text-[#68737a] transition hover:text-[#405f73]"
              >
                Features
              </Link>
              <Link
                href="#how-it-works"
                className="text-sm font-medium text-[#68737a] transition hover:text-[#405f73]"
              >
                How it works
              </Link>
              <Link
                href="#faq"
                className="text-sm font-medium text-[#68737a] transition hover:text-[#405f73]"
              >
                FAQ
              </Link>
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <Link
                href={appHref}
                className="rounded-full px-5 py-3 text-sm font-semibold transition hover:bg-[#e9eef1]"
              >
                {user ? "My dashboard" : "Log in"}
              </Link>
              <Link
                href={signupHref}
                className="inline-flex items-center gap-2 rounded-full bg-[#405f73] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#324e60]"
              >
                {user ? "Open app" : "Get started"}
                <ArrowRight size={16} />
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dfe5e8] md:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </nav>

          {menuOpen && (
            <div className="border-t border-[#e4e8e9] bg-[#f7f8f8] px-5 py-5 md:hidden">
              <div className="mx-auto flex max-w-7xl flex-col gap-1">
                {[
                  ["Features", "#features"],
                  ["How it works", "#how-it-works"],
                  ["FAQ", "#faq"],
                ].map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-medium hover:bg-[#e9eef1]"
                  >
                    {label}
                  </Link>
                ))}
                <Link
                  href={appHref}
                  onClick={() => setMenuOpen(false)}
                  className="mt-2 rounded-full bg-[#405f73] px-5 py-3 text-center text-sm font-semibold text-white"
                >
                  {user ? "Open dashboard" : "Log in"}
                </Link>
                {!user && (
                  <Link
                    href="/auth/signUp"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-full border border-[#d9e1e5] px-5 py-3 text-center text-sm font-semibold"
                  >
                    Create account
                  </Link>
                )}
              </div>
            </div>
          )}
        </header>

        <main>
          {/* Hero */}
          <section className="relative px-5 pb-10 pt-10 sm:px-8 sm:pt-16 lg:px-12 lg:pb-12 lg:pt-10">
            <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-[#e0e9ee]/60 blur-3xl" />
            <div className="pointer-events-none absolute right-0 top-32 h-80 w-80 rounded-full bg-[#e9edf0]/70 blur-3xl" />

            <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1fr_0.95fr] lg:gap-12">
              <div className="max-w-2xl">
                <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#dce5e9] bg-white/70 px-4 py-2 text-sm font-medium text-[#587587]">
                  <Sparkles size={15} />
                  A more organized approach to your health
                </div>

                <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.055em] sm:text-6xl lg:text-[72px]">
                  Your health,
                  <br />
                  <span className="font-normal italic text-[#718b9b]">
                    in perspective.
                  </span>
                </h1>

                <p className="mt-7 max-w-xl text-base leading-8 text-[#69747b] sm:text-lg">
                  Make sense of your day-to-day health. Keep symptoms,
                  routines, and health history organized in one place, so you
                  can focus on what matters.
                </p>

                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={signupHref}
                    className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[#405f73] px-7 py-4 text-base font-semibold text-white shadow-lg shadow-[#405f73]/10 transition hover:-translate-y-0.5 hover:bg-[#324e60] hover:shadow-xl"
                  >
                    {user ? "Go to your dashboard" : "Get started"}
                    <ArrowRight size={18} />
                  </Link>
                  <Link
                    href="#features"
                    className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-[#dce4e8] bg-white/60 px-7 py-4 text-base font-semibold transition hover:bg-white"
                  >
                    Explore features
                    <ArrowDownRight size={18} />
                  </Link>
                </div>

                <div className="mt-9 flex items-center gap-3 text-sm text-[#768188]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e3ebef] text-[#587587]">
                    <ShieldCheck size={17} />
                  </span>
                  Your health information deserves thoughtful care.
                </div>
              </div>

              {/* Illustrative dashboard preview */}
              <div className="relative mx-auto w-full max-w-[540px]">
                <div className="absolute -inset-5 rounded-[36px] bg-[#e2e9ed]/70 blur-2xl" />

                <div className="relative rounded-[28px] border border-[#e3e8ea] bg-white p-5 shadow-[0_30px_90px_-35px_rgba(47,69,81,0.22)] sm:p-7">
                  <div className="flex items-center justify-between border-b border-[#edf0f1] pb-5">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#89939a]">
                        Your overview
                      </p>
                      <h2 className="mt-1 text-xl font-semibold tracking-tight">
                        Health at a glance
                      </h2>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e6edf1] text-[#587587]">
                      <HeartPulse size={23} />
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-[#f0f4f5] p-4 sm:p-5">
                      <div className="flex items-center justify-between">
                        <Activity size={19} className="text-[#718b9b]" />
                        <span className="text-xs text-[#89939a]">Today</span>
                      </div>
                      <p className="mt-5 text-sm text-[#718087]">
                        Daily check-in
                      </p>
                      <p className="mt-1 text-lg font-semibold">
                        Your wellbeing
                      </p>
                      <p className="mt-2 text-xs text-[#849097]">
                        Make space to reflect
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#f4f1ec] p-4 sm:p-5">
                      <div className="flex items-center justify-between">
                        <CalendarDays
                          size={19}
                          className="text-[#927d66]"
                        />
                        <span className="text-xs text-[#998d7e]">Routine</span>
                      </div>
                      <p className="mt-5 text-sm text-[#8b7e6e]">
                        Health notes
                      </p>
                      <p className="mt-1 text-lg font-semibold">
                        Stay organized
                      </p>
                      <p className="mt-2 text-xs text-[#998d7e]">
                        Keep details together
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[#e6eaec] p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          Your health journey
                        </p>
                        <p className="mt-1 text-xs text-[#879198]">
                          Small check-ins add up over time
                        </p>
                      </div>
                      <span className="rounded-full bg-[#eaf0f3] px-3 py-1 text-xs font-medium text-[#587587]">
                        One day at a time
                      </span>
                    </div>

                    <div className="mt-5 flex h-[92px] items-end gap-2 sm:gap-3">
                      {[34, 48, 40, 65, 52, 76, 62, 88, 68, 79, 56, 72].map(
                        (height, index) => (
                          <div
                            key={index}
                            className={`flex-1 rounded-t-md ${
                              index === 7 ? "bg-[#587587]" : "bg-[#dce6eb]"
                            }`}
                            style={{ height: `${height}%` }}
                          />
                        )
                      )}
                    </div>
                    <div className="mt-3 flex justify-between text-[11px] text-[#9aa2a7]">
                      <span>Earlier</span>
                      <span>Illustrative preview</span>
                      <span>Later</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#405f73] p-4 text-white">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                      <Heart size={19} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        Your health, your pace
                      </p>
                      <p className="mt-1 text-xs leading-5 text-white/75">
                        Build a record that works for you.
                      </p>
                    </div>
                    <ArrowDownRight size={19} className="ml-auto shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Features */}
          <section
            id="features"
            className="scroll-mt-24 px-5 pt-12 pb-20 sm:px-8 sm:pt-14 lg:px-12 lg:pt-16 lg:pb-24"
          >
            <div className="mx-auto max-w-7xl">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.17em] text-[#718b9b]">
                  Designed around you
                </p>
                <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
                  A little more clarity,
                  <br />
                  <span className="font-normal italic text-[#718b9b]">
                    day by day.
                  </span>
                </h2>
                <p className="mt-5 max-w-xl leading-7 text-[#737d83]">
                  Keeping up with your health can feel like a lot. SymptomSync
                  brings useful tools together to make the process more
                  manageable.
                </p>
              </div>

              <div className="mt-12 grid gap-5 md:grid-cols-3">
                {features.map((feature, index) => {
                  const Icon = feature.icon;

                  return (
                    <article
                      key={feature.title}
                      className="group rounded-[26px] border border-[#e3e8ea] bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-[#cbd9e1] hover:shadow-[0_20px_50px_-30px_rgba(47,69,81,0.22)] sm:p-8"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`flex h-14 w-14 items-center justify-center rounded-2xl ${feature.color}`}
                        >
                          <Icon size={25} strokeWidth={1.8} />
                        </span>
                        <span className="text-sm font-medium text-[#a4abb0]">
                          0{index + 1}
                        </span>
                      </div>
                      <h3 className="mt-7 text-xl font-semibold tracking-tight">
                        {feature.title}
                      </h3>
                      <p className="mt-3 min-h-[72px] text-sm leading-7 text-[#737d83]">
                        {feature.description}
                      </p>
                      <div className="mt-6 h-px bg-[#edf0f1] transition group-hover:bg-[#d5e1e7]" />
                      <Link
                        href={appHref}
                        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#587587]"
                      >
                        Explore your dashboard
                        <ArrowRight
                          size={16}
                          className="transition group-hover:translate-x-1"
                        />
                      </Link>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          {/* How it works */}
          <section
            id="how-it-works"
            className="scroll-mt-24 bg-[#eaf0f3] px-5 py-24 sm:px-8 lg:px-12 lg:py-28"
          >
            <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.17em] text-[#718b9b]">
                  Getting started
                </p>
                <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
                  Make room for
                  <br />
                  <span className="font-normal italic text-[#718b9b]">
                    what matters.
                  </span>
                </h2>
                <p className="mt-5 max-w-md leading-7 text-[#68767e]">
                  A simple place to start building a clearer picture of your
                  day-to-day health.
                </p>
                <Link
                  href={signupHref}
                  className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#405f73] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#324e60]"
                >
                  {user ? "Return to your dashboard" : "Create your account"}
                  <ArrowRight size={17} />
                </Link>
              </div>

              <div className="space-y-4">
                {[
                  {
                    number: "01",
                    icon: HeartPulse,
                    title: "Start with your day",
                    description:
                      "Open your account and explore the available health tracking tools.",
                  },
                  {
                    number: "02",
                    icon: CalendarDays,
                    title: "Record what matters",
                    description:
                      "Keep relevant symptoms, health notes, and routines organized.",
                  },
                  {
                    number: "03",
                    icon: TrendingUp,
                    title: "Look back over time",
                    description:
                      "Use your records to prepare for conversations and reflect on changes.",
                  },
                ].map((step) => {
                  const Icon = step.icon;

                  return (
                    <div
                      key={step.number}
                      className="flex gap-5 rounded-2xl border border-[#dce5e9] bg-white/75 p-5 sm:gap-6 sm:p-6"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e3ebef] text-[#587587]">
                        <Icon size={22} />
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-xs font-semibold tracking-widest text-[#7e96a4]">
                            {step.number}
                          </span>
                          <h3 className="text-lg font-semibold">
                            {step.title}
                          </h3>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[#737d83]">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section
            id="faq"
            className="scroll-mt-24 px-5 py-24 sm:px-8 lg:px-12 lg:py-28"
          >
            <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.17em] text-[#718b9b]">
                  Good to know
                </p>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                  Questions?
                  <br />
                  <span className="font-normal italic text-[#718b9b]">
                    Start here.
                  </span>
                </h2>
                <p className="mt-5 max-w-sm leading-7 text-[#737d83]">
                  A few things to know before you get started with SymptomSync.
                </p>
              </div>

              <div className="divide-y divide-[#e3e8ea] border-y border-[#e3e8ea]">
                {faqs.map((faq, index) => (
                  <div key={faq.question}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-5 py-6 text-left"
                      onClick={() =>
                        setOpenFaq(openFaq === index ? null : index)
                      }
                      aria-expanded={openFaq === index}
                    >
                      <span className="font-semibold">{faq.question}</span>
                      <ChevronDown
                        size={19}
                        className={`shrink-0 text-[#718b9b] transition-transform ${
                          openFaq === index ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {openFaq === index && (
                      <p className="max-w-2xl pb-6 pr-8 text-sm leading-7 text-[#737d83]">
                        {faq.answer}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Final call to action */}
          <section className="px-5 pb-20 sm:px-8 lg:px-12 lg:pb-24">
            <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[30px] bg-[#405f73] px-6 py-16 text-center text-white sm:px-12 sm:py-20">
              <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full border border-white/10" />
              <div className="pointer-events-none absolute -bottom-48 -left-20 h-96 w-96 rounded-full border border-white/10" />

              <div className="relative mx-auto max-w-2xl">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                  <HeartPulse size={27} />
                </span>
                <h2 className="mt-6 text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
                  A clearer picture
                  <br />
                  starts with today.
                </h2>
                <p className="mx-auto mt-5 max-w-lg leading-7 text-white/75">
                  Give your health information a home and take the next step at
                  your own pace.
                </p>
                <Link
                  href={signupHref}
                  className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#f7f8f8] px-7 py-4 text-sm font-semibold text-[#405f73] transition hover:-translate-y-0.5 hover:bg-white"
                >
                  {user ? "Open your dashboard" : "Get started with SymptomSync"}
                  <ArrowRight size={17} />
                </Link>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-[#e3e8ea] px-5 py-8 sm:px-8 lg:px-12">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#405f73] text-white">
                <HeartPulse size={19} />
              </span>
              <span className="font-bold tracking-tight">
                Symptom<span className="text-[#718b9b]">Sync</span>
              </span>
            </Link>

            <p className="text-xs leading-6 text-[#858e94]">
              For personal health tracking and organization. Not a substitute
              for professional medical advice.
            </p>

            <div className="flex items-center gap-5">
              <Link
                href="/privacy"
                className="text-sm text-[#68747b] transition hover:text-[#405f73]"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="text-sm text-[#68747b] transition hover:text-[#405f73]"
              >
                Terms
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-7 max-w-7xl border-t border-[#e5e9eb] pt-5 text-xs text-[#929ba0]">
            © {new Date().getFullYear()} SymptomSync. All rights reserved.
          </div>
        </footer>
      </div>
    </>
  );
}