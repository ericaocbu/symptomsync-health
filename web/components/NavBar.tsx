
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Calendar,
  MessageSquare,
  User,
  Menu,
  LogIn,
  LogOut,
  FileText,
  List,
  X,
  HeartPulse,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { signOut } from "@/lib/auth";
import { ModeToggle } from "@/components/ModeToggle";

type NavItemProps = {
  href: string;
  icon: React.ReactNode;
  label: string;
  isExpanded: boolean;
  onClick?: () => void;
};

function NavItem({
  href,
  icon,
  label,
  isExpanded,
  onClick,
}: NavItemProps) {
  const router = useRouter();

  const active =
    router.asPath === href ||
    (href !== "/home" && router.asPath.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      onClick={onClick}
      title={!isExpanded ? label : undefined}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`
        group relative flex w-full items-center rounded-xl
        py-3 text-sm font-medium transition-all duration-200
        ${isExpanded ? "gap-3 px-3" : "justify-center px-0"}
        ${
          active
            ? "bg-white text-[#405f73] shadow-sm"
            : "text-white/75 hover:bg-white/10 hover:text-white"
        }
      `}
    >
      {active && (
        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#9db8c8]" />
      )}

      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
        {icon}
      </span>

      {isExpanded && (
        <span className="whitespace-nowrap">{label}</span>
      )}

      {!isExpanded && (
        <span
          className="
            pointer-events-none absolute left-full top-1/2 z-[60]
            ml-3 -translate-y-1/2 translate-x-1 opacity-0
            whitespace-nowrap rounded-lg bg-[#27333b] px-3 py-2
            text-xs font-medium text-white shadow-lg
            transition-all duration-150
            group-hover:translate-x-0 group-hover:opacity-100
          "
        >
          {label}
        </span>
      )}
    </Link>
  );
}

type NavBarProps = {
  staticNav?: boolean;
  isExpanded: boolean;
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function NavBar({
  staticNav = false,
  isExpanded,
  setIsExpanded,
}: NavBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setIsLoggedIn(!!session?.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (window.innerWidth >= 768 || !mobileOpen) return;

      const target = event.target as Node;

      if (
        navRef.current &&
        mobileButtonRef.current &&
        !navRef.current.contains(target) &&
        !mobileButtonRef.current.contains(target)
      ) {
        setMobileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [mobileOpen]);

  useEffect(() => {
    const handleRouteChange = () => setMobileOpen(false);

    router.events.on("routeChangeStart", handleRouteChange);

    return () => {
      router.events.off("routeChangeStart", handleRouteChange);
    };
  }, [router.events]);

  const handleLogout = async () => {
    try {
      await signOut();
      setMobileOpen(false);
      await router.push("/auth/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const widthClass = isExpanded ? "w-64" : "w-[88px]";

  const mobileTranslate = mobileOpen
    ? "translate-x-0"
    : "-translate-x-full";

  const containerClasses = staticNav
    ? `${widthClass} relative flex h-screen shrink-0 flex-col justify-between bg-[#405f73] text-white shadow-xl transition-[width] duration-300 ease-in-out`
    : `
        fixed left-0 top-0 z-40 flex h-screen ${widthClass}
        flex-col justify-between bg-[#405f73] text-white shadow-xl
        transition-[width,transform] duration-300 ease-in-out
        ${mobileTranslate} md:translate-x-0
      `;

  const handleToggle = () => {
    setIsExpanded((previous) => !previous);
  };

  return (
    <>
      {!staticNav && (
        <button
          ref={mobileButtonRef}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setMobileOpen((previous) => !previous);
          }}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
          className="
            fixed right-4 top-4 z-50 flex h-10 w-10 items-center
            justify-center rounded-xl bg-[#405f73] text-white
            shadow-lg transition-colors hover:bg-[#324e60]
            cursor-pointer md:hidden
          "
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      )}

      {!staticNav && mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
        />
      )}

      <nav
        ref={navRef}
        aria-label="Main navigation"
        className={containerClasses}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-visible">
          {/* Brand */}
          <div
            className={`
              flex h-[76px] shrink-0 items-center border-b
              border-white/10
              ${isExpanded ? "justify-start px-5" : "justify-center px-3"}
            `}
          >
            <Link
              href="/home"
              aria-label="SymptomSync home"
              className="flex items-center gap-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#405f73] shadow-sm">
                <HeartPulse className="h-5 w-5" />
              </span>

              {isExpanded && (
                <span className="whitespace-nowrap text-lg font-bold tracking-tight text-white">
                  Symptom
                  <span className="text-[#b8ccd8]">Sync</span>
                </span>
              )}
            </Link>
          </div>

          {/* Main navigation */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-6">
            {isExpanded && (
              <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                Workspace
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <NavItem
                href="/home"
                icon={<Home className="h-5 w-5" />}
                label="Home"
                isExpanded={isExpanded}
                onClick={() => setMobileOpen(false)}
              />

              <NavItem
                href="/calendar"
                icon={<Calendar className="h-5 w-5" />}
                label="Calendar"
                isExpanded={isExpanded}
                onClick={() => setMobileOpen(false)}
              />

              <NavItem
                href="/chat"
                icon={<MessageSquare className="h-5 w-5" />}
                label="Chat"
                isExpanded={isExpanded}
                onClick={() => setMobileOpen(false)}
              />

              <NavItem
                href="/uploads"
                icon={<FileText className="h-5 w-5" />}
                label="Documents"
                isExpanded={isExpanded}
                onClick={() => setMobileOpen(false)}
              />

              <NavItem
                href="/reminder"
                icon={<List className="h-5 w-5" />}
                label="Medications"
                isExpanded={isExpanded}
                onClick={() => setMobileOpen(false)}
              />
            </div>

            <div className="my-6 border-t border-white/10" />

            {isExpanded && (
              <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                Account
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <NavItem
                href="/profile"
                icon={<User className="h-5 w-5" />}
                label="Profile"
                isExpanded={isExpanded}
                onClick={() => setMobileOpen(false)}
              />

              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  title={!isExpanded ? "Log Out" : undefined}
                  aria-label="Log Out"
                  className={`
                    group relative flex w-full items-center rounded-xl
                    py-3 text-sm font-medium text-white/75
                    transition-colors hover:bg-white/10 hover:text-white
                    cursor-pointer
                    ${isExpanded ? "gap-3 px-3" : "justify-center px-0"}
                  `}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                    <LogOut className="h-5 w-5" />
                  </span>

                  {isExpanded && (
                    <span className="whitespace-nowrap">Log Out</span>
                  )}

                  {!isExpanded && (
                    <span
                      className="
                        pointer-events-none absolute left-full top-1/2
                        z-[60] ml-3 -translate-y-1/2 translate-x-1
                        whitespace-nowrap rounded-lg bg-[#27333b] px-3
                        py-2 text-xs font-medium text-white opacity-0
                        shadow-lg transition-all duration-150
                        group-hover:translate-x-0 group-hover:opacity-100
                      "
                    >
                      Log Out
                    </span>
                  )}
                </button>
              ) : (
                <NavItem
                  href="/auth/login"
                  icon={<LogIn className="h-5 w-5" />}
                  label="Log In"
                  isExpanded={isExpanded}
                  onClick={() => setMobileOpen(false)}
                />
              )}
            </div>

            <div className="my-6 border-t border-white/10" />

            {/* Appearance */}
            <div
              className={`
                flex items-center
                ${isExpanded ? "justify-between px-3" : "justify-center"}
              `}
            >
              {isExpanded && (
                <span className="text-xs font-medium text-white/60">
                  Appearance
                </span>
              )}

              <ModeToggle isExpanded={isExpanded} />
            </div>
          </div>
        </div>

        {/* Collapse control */}
        <div className="shrink-0 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={handleToggle}
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={isExpanded}
            title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
            className={`
              flex w-full items-center rounded-xl py-3
              text-sm font-medium text-white/70
              transition-colors hover:bg-white/10 hover:text-white
              cursor-pointer
              ${isExpanded ? "justify-between px-3" : "justify-center"}
            `}
          >
            {isExpanded && <span>Collapse sidebar</span>}

            {isExpanded ? (
              <ChevronLeft className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
