import { supabase } from "@/lib/supabaseClient";

type ChatHistoryMessage = {
  role: string;
  parts: Array<{ text: string }>;
};

type ChatApiResponse = {
  text?: string;
  error?: string;
};

export async function chatWithHealthAI(
  history: ChatHistoryMessage[],
  message: string,
  systemInstruction = "",
  userContext?: string,
): Promise<string> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error("Please sign in again to use the AI assistant.");
  }

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      history,
      message,
      systemInstruction,
      userContext,
    }),
  });

  let result: ChatApiResponse;

  try {
    result = (await response.json()) as ChatApiResponse;
  } catch {
    throw new Error("The AI service returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(
      result.error || "Unable to get a response from the AI assistant.",
    );
  }

  if (typeof result.text !== "string" || !result.text.trim()) {
    throw new Error("The AI assistant returned an empty response.");
  }

  return result.text;
}