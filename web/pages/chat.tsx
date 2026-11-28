import React, { useState, useEffect, useRef } from "react";
import type { Components } from "react-markdown";
import { useRouter } from "next/router";
import Head from "next/head";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  HeartPulse,
  Loader2,
  Send,
  Trash2,
  UserRound,
  Sparkles,
  MessageCircle,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { chatWithHealthAI } from "@/lib/aiChat";
import { getMedicationRemindersByUser } from "@/lib/medications";
import { getAppointmentRemindersByUser } from "@/lib/appointmentReminders";
import { getHealthLogsByUser } from "@/lib/healthLogs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Role = "user" | "model";

type ChatMessage = {
  role: Role;
  text: string;
};

const markdownComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1
      className="mb-4 mt-5 border-b border-border pb-2 text-2xl font-bold text-foreground first:mt-0"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="mb-3 mt-5 border-b border-border pb-2 text-xl font-bold text-foreground first:mt-0"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="mb-2 mt-4 text-lg font-semibold text-foreground"
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4
      className="mb-2 mt-3 text-base font-semibold text-foreground"
      {...props}
    >
      {children}
    </h4>
  ),
  p: ({ children, ...props }) => (
    <p
      className="mb-3 text-sm leading-7 text-foreground last:mb-0"
      {...props}
    >
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul
      className="mb-3 ml-5 list-disc space-y-1 text-sm leading-7 text-foreground"
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol
      className="mb-3 ml-5 list-decimal space-y-1 text-sm leading-7 text-foreground"
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="pl-1" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-foreground" {...props}>
      {children}
    </strong>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-3 border-l-4 border-primary/50 pl-4 italic text-muted-foreground"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: (props) => <hr className="my-4 border-border" {...props} />,
  a: ({ children, ...props }) => (
    <a
      className="text-primary underline underline-offset-4 hover:opacity-80"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  code: ({ children, className, ...props }) => (
    <code
      className={`rounded-md bg-muted px-1.5 py-1 font-mono text-xs text-foreground ${
        className ?? ""
      }`}
      {...props}
    >
      {children}
    </code>
  ),
  pre: ({ children, ...props }) => (
    <pre
      className="my-3 overflow-x-auto rounded-xl border border-border bg-muted p-4 text-sm text-foreground"
      {...props}
    >
      {children}
    </pre>
  ),
  table: ({ children, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-border">
      <table
        className="w-full border-collapse text-left text-sm"
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-muted text-foreground" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }) => (
    <tbody className="divide-y divide-border" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }) => (
    <tr className="border-b border-border last:border-0" {...props}>
      {children}
    </tr>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border-b border-border px-4 py-3 font-semibold text-foreground"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td
      className="border-b border-border px-4 py-3 align-top text-foreground"
      {...props}
    >
      {children}
    </td>
  ),
};

const isChatMessageArray = (value: unknown): value is ChatMessage[] => {
  return (
    Array.isArray(value) &&
    value.every(
      (message) =>
        message &&
        (message.role === "user" || message.role === "model") &&
        typeof message.text === "string",
    )
  );
};

// Keeps the chat client-rendered to avoid local-storage hydration differences.
const ClientOnly: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <>{children}</>;
};

export default function AIChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const broadcastChannelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Authenticate the user.
  useEffect(() => {
    let isMounted = true;

    async function checkUserAuth() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (error || !user) {
          router.replace("/auth/login");
          return;
        }

        setUserId(user.id);
      } catch (error) {
        console.error("Authentication error:", error);

        if (isMounted) {
          router.replace("/auth/login");
        }
      }
    }

    checkUserAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // Load the conversation belonging to the authenticated user.
  useEffect(() => {
    if (!userId) return;

    try {
      const stored = localStorage.getItem(`symptomSyncChat-${userId}`);

      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        setMessages(isChatMessageArray(parsed) ? parsed : []);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error("Could not load saved conversation:", error);
      setMessages([]);
    }

    setLoadedUserId(userId);
  }, [userId]);

  // Save messages only after the correct user's conversation has loaded.
  useEffect(() => {
    if (!userId || loadedUserId !== userId) return;

    localStorage.setItem(
      `symptomSyncChat-${userId}`,
      JSON.stringify(messages),
    );
  }, [messages, userId, loadedUserId]);

  // Keep the latest message visible.
  useEffect(() => {
    if (messages.length === 0) return;

    const timeout = window.setTimeout(() => {
      scrollRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 100);

    return () => window.clearTimeout(timeout);
  }, [messages, loading]);

  // Subscribe to user-specific broadcast notifications.
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`user-channel-${userId}`, {
      config: { broadcast: { self: false } },
    });

    broadcastChannelRef.current = channel;

    channel
      .on("broadcast", { event: "*" }, (payload) => {
        const message = payload.payload?.message;

        if (typeof message === "string" && message.trim()) {
          toast.success(
            `Notification: ${message.replace(/\./g, "")} from another device or tab.`,
          );
        }
      })
      .subscribe((status) => {
        console.log("User-specific channel status:", status);
      });

    return () => {
      void supabase.removeChannel(channel);
      broadcastChannelRef.current = null;
    };
  }, [userId]);

  // Send a message and retrieve the user's health information for context.
  async function handleSend() {
    const messageText = userInput.trim();

    if (!messageText || loading || !userId) return;

    setLoading(true);

    const newUserMessage: ChatMessage = {
      role: "user",
      text: messageText,
    };

    const updatedMessages = [...messages, newUserMessage];

    setMessages(updatedMessages);
    setUserInput("");

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user || user.id !== userId) {
        throw new Error("Your session could not be verified. Please log in again.");
      }

      const [meds, appts, logs] = await Promise.all([
        getMedicationRemindersByUser(user.id),
        getAppointmentRemindersByUser(user.id),
        getHealthLogsByUser(user.id),
      ]);

      let userDataSummary = "Appointments:\n";

      if (appts.length === 0) {
        userDataSummary += "- None\n";
      } else {
        appts.forEach((appointment) => {
          const dateString = new Date(
            appointment.date,
          ).toLocaleString();

          userDataSummary += `- ${appointment.appointment_name} on ${dateString}\n`;
        });
      }

      userDataSummary += "\nMedications:\n";

      if (meds.length === 0) {
        userDataSummary += "- None\n";
      } else {
        meds.forEach((medication) => {
          userDataSummary += `- ${medication.medication_name}, dosage: ${
            medication.dosage ?? "N/A"
          }, next time: ${new Date(
            medication.reminder_time,
          ).toLocaleString()}, recurrence: ${
            medication.recurrence ?? "N/A"
          }\n`;
        });
      }

      userDataSummary += "\nRecent Health Logs:\n";

      if (logs.length === 0) {
        userDataSummary += "- None\n";
      } else {
        logs.slice(-3).forEach((log) => {
          userDataSummary += `- Symptom: ${
            log.symptom_type ?? "N/A"
          }, severity: ${log.severity ?? 0}, start: ${new Date(
            log.start_date,
          ).toLocaleString()}\n`;
        });
      }

      const newHistory = updatedMessages.map((message) => ({
        role: message.role,
        parts: [{ text: message.text }],
      }));

      const aiResponse = await chatWithHealthAI(
        newHistory,
        messageText,
        undefined,
        userDataSummary,
      );

      setMessages((previous) => [
        ...previous,
        { role: "model", text: aiResponse },
      ]);
    } catch (error) {
      console.error("Chat error:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong while sending your message. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  // Clear the current user's conversation.
  function handleClear() {
    if (loading) return;

    setMessages([]);

    if (userId) {
      localStorage.removeItem(`symptomSyncChat-${userId}`);
    }

    toast.success("Conversation cleared.");
  }

  function handleSuggestion(suggestion: string) {
    setUserInput(suggestion);
  }

  return (
    <>
      <Head>
        <title>SymptomSync | AI Health Assistant</title>
        <meta
          name="description"
          content="Chat with your SymptomSync AI Health Assistant."
        />
      </Head>

      <ClientOnly>
        <div className="flex min-h-screen flex-col bg-background px-4 py-6 text-foreground transition-colors duration-200 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
            {/* Page header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
                  <HeartPulse className="h-6 w-6" />
                </div>

                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                      AI Health Assistant
                    </h1>

                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/70 px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Personal assistant
                    </span>
                  </div>

                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    Ask questions, explore your health information, and get
                    helpful guidance based on your SymptomSync records.
                  </p>
                </div>
              </div>

              {messages.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClear}
                  disabled={loading}
                  className="w-full cursor-pointer gap-2 border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed sm:w-auto"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear conversation
                </Button>
              )}
            </div>

            {/* Chat panel */}
            <div className="flex min-h-[580px] flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {/* Chat panel header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
                    <Bot className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      SymptomSync Assistant
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Your health information companion
                    </p>
                  </div>
                </div>

                <div className="hidden items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground sm:flex">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  AI-powered assistance
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-5 overflow-y-auto bg-background/40 px-4 py-6 sm:px-6">
                {messages.length === 0 && !loading && (
                  <div className="flex min-h-[390px] flex-col items-center justify-center px-2 py-8 text-center">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-primary">
                      <MessageCircle className="h-8 w-8" />
                    </div>

                    <h3 className="mb-2 text-xl font-semibold text-foreground">
                      How can I help you today?
                    </h3>

                    <p className="mb-7 max-w-md text-sm leading-6 text-muted-foreground">
                      Ask me about your medications, appointments, health
                      logs, or general health questions.
                    </p>

                    <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
                      {[
                        {
                          title: "My medications",
                          description: "Help me review my medications.",
                          prompt:
                            "Can you help me review my current medications?",
                        },
                        {
                          title: "Upcoming appointments",
                          description: "What appointments do I have coming up?",
                          prompt:
                            "Can you summarize my upcoming appointments?",
                        },
                        {
                          title: "Health logs",
                          description: "Help me understand my recent logs.",
                          prompt:
                            "Can you help me review my recent health logs?",
                        },
                      ].map((suggestion) => (
                        <button
                          key={suggestion.title}
                          type="button"
                          onClick={() =>
                            handleSuggestion(suggestion.prompt)
                          }
                          className="group cursor-pointer rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-secondary/40"
                        >
                          <p className="mb-1 text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                            {suggestion.title}
                          </p>
                          <p className="text-xs leading-5 text-muted-foreground">
                            {suggestion.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <AnimatePresence initial={false}>
                  {messages.map((message, index) => {
                    const isUser = message.role === "user";

                    return (
                      <motion.div
                        key={`${index}-${message.role}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className={`flex items-end gap-2.5 ${
                          isUser ? "justify-end" : "justify-start"
                        }`}
                      >
                        {!isUser && (
                          <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                            <Bot className="h-4 w-4" />
                          </div>
                        )}

                        <div
                          className={`max-w-[88%] overflow-hidden rounded-2xl px-4 py-3 shadow-sm sm:max-w-[80%] lg:max-w-[72%] ${
                            isUser
                              ? "rounded-br-md bg-primary text-primary-foreground"
                              : "rounded-bl-md border border-border bg-card text-foreground"
                          }`}
                        >
                          {isUser ? (
                            <p className="whitespace-pre-wrap text-sm leading-7 text-primary-foreground">
                              {message.text}
                            </p>
                          ) : (
                            <div className="min-w-0 break-words">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                              >
                                {message.text}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>

                        {isUser && (
                          <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <UserRound className="h-4 w-4" />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* AI loading indicator */}
                {loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-end gap-2.5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                      <Bot className="h-4 w-4" />
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">
                        Thinking...
                      </span>
                    </div>
                  </motion.div>
                )}

                <div ref={scrollRef} />
              </div>

              {/* Message input */}
              <div className="border-t border-border bg-card p-4 sm:p-5">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSend();
                  }}
                  className="mx-auto flex w-full max-w-4xl items-center gap-2"
                >
                  <div className="relative flex-1">
                    <Input
                      value={userInput}
                      onChange={(event) => setUserInput(event.target.value)}
                      placeholder="Ask a question about your health..."
                      disabled={loading || !userId}
                      aria-label="Message the AI health assistant"
                      className="h-12 rounded-xl border-input bg-background pr-4 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring disabled:cursor-not-allowed"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !userInput.trim() || !userId}
                    className="h-12 cursor-pointer gap-2 rounded-xl bg-primary px-4 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Send</span>
                  </Button>
                </form>

                <p className="mt-3 text-center text-xs text-muted-foreground">
                  AI responses are for informational purposes and are not a
                  substitute for professional medical advice.
                </p>
              </div>
            </div>
          </div>
        </div>
      </ClientOnly>
    </>
  );
}