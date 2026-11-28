
import "react-big-calendar/lib/css/react-big-calendar.css";
import "@/styles/globals.css";

import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import NavBar from "@/components/NavBar";
import { Toaster, toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { Analytics } from "@vercel/analytics/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";

const queryClient = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Hide navigation on landing, authentication, and 404 pages.
  const authPaths = [
    "/",
    "/auth/signUp",
    "/auth/login",
    "/404",
    "/auth/forgotPassword",
    "/auth/updatePassword",
  ];

  const hideNav = authPaths.includes(router.pathname);

  const [navExpanded, setNavExpanded] = useState<boolean>(true);
  const [userId, setUserId] = useState<string | null>(null);

  const broadcastChannelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Restore the user's sidebar preference.
  useEffect(() => {
    const storedPref = localStorage.getItem("navExpanded");

    if (storedPref !== null) {
      setNavExpanded(storedPref === "true");
    }
  }, []);

  // Persist the sidebar preference.
  useEffect(() => {
    localStorage.setItem("navExpanded", String(navExpanded));
  }, [navExpanded]);

  // Get the currently authenticated user.
  useEffect(() => {
    let isMounted = true;

    async function init() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error("Unable to retrieve authenticated user:", error);
        return;
      }

      if (user && isMounted) {
        setUserId(user.id);
      }
    }

    void init();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Supabase Realtime #3: Reminder notifications.
   * When a reminder is due, a notification is inserted into
   * user_notifications and displayed to the user through Sonner.
   */
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`reminders-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_notifications",
          filter: `user_profile_id=eq.${userId}`,
        },
        (payload) => {
          const { title, body } = payload.new as {
            title: string;
            body: string;
          };

          toast.info(title, {
            description: body,
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  /**
   * Supabase Realtime #2: Universal broadcast notifications.
   * Displays a toast when another device broadcasts a message.
   */
  useEffect(() => {
    const channel = supabase.channel("universal-channel", {
      config: {
        broadcast: {
          self: false,
        },
      },
    });

    broadcastChannelRef.current = channel;

    channel
      .on("broadcast", { event: "*" }, (payload) => {
        const message = payload?.payload?.message;

        if (typeof message === "string" && message.length > 0) {
          toast.success(`Notification: ${message}`);
        }
      })
      .subscribe((status) => {
        console.log("Universal channel status:", status);
      });

    return () => {
      void supabase.removeChannel(channel);
      broadcastChannelRef.current = null;
    };
  }, []);

  // Sidebar width is handled responsively with CSS.
  const marginLeft = navExpanded ? "16rem" : "5rem";

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        {hideNav ? (
          <Component {...pageProps} />
        ) : (
          <>
            <NavBar
              isExpanded={navExpanded}
              setIsExpanded={setNavExpanded}
              staticNav={false}
            />

            <main
              className="
                ml-0 transition-all duration-300
                md:[margin-left:var(--sidebar-margin)]
              "
              style={
                {
                  "--sidebar-margin": marginLeft,
                } as React.CSSProperties
              }
            >
              <Component {...pageProps} />
            </main>
          </>
        )}

        <Toaster position="bottom-right" richColors />
        <Analytics />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
