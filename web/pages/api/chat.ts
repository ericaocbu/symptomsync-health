import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type HistoryMessage = {
  role: string;
  parts: Array<{ text: string }>;
};

type ChatRequest = {
  history?: HistoryMessage[];
  message?: string;
  systemInstruction?: string;
  userContext?: string;
};

type ApiResponse = {
  text?: string;
  error?: string;
};

const MODEL = "openai/gpt-oss-20b";

const DEFAULT_SYSTEM_INSTRUCTION = `
You are SymptomSync Assistant, a helpful and empathetic health information assistant.

Your role:
- Help users understand general health information.
- Explain health terminology in accessible language.
- Help users organize and understand their medications, appointments, and health logs.
- Offer general wellness information when appropriate.
- Be respectful, supportive, clear, and nonjudgmental.
- Use the user's provided health information only when it is relevant to their question.

Important health and safety guidelines:
- You are an AI assistant, not a doctor or licensed medical professional.
- Do not claim to diagnose, treat, or cure medical conditions.
- Do not tell users to start, stop, or change prescription medications without consulting a healthcare professional.
- Encourage users to contact a qualified healthcare professional for personal medical decisions.
- If a user describes potentially life-threatening symptoms or an emergency, advise them to seek emergency medical care immediately.
- Do not invent medical history, medication details, appointments, or health information.
- If information is missing or unclear, say so.
- Do not present uncertain medical information as fact.
- Keep answers easy to understand and organize longer answers with headings or bullet points.

The user may provide personal health information for context. Treat it as private and use only what is necessary to answer their question.
`;

function sendError(
  res: NextApiResponse<ApiResponse>,
  status: number,
  error: string,
) {
  return res.status(status).json({ error });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return sendError(res, 405, "Method not allowed.");
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!groqApiKey) {
    console.error("GROQ_API_KEY is not configured.");
    return sendError(res, 500, "The AI service is not configured.");
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase environment variables are not configured.");
    return sendError(res, 500, "Authentication service is not configured.");
  }

  // Verify the authenticated Supabase user.
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return sendError(res, 401, "Please sign in to use the AI assistant.");
  }

  const accessToken = authorization.slice("Bearer ".length);

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return sendError(
        res,
        401,
        "Your session has expired. Please sign in again.",
      );
    }

    const body = req.body as ChatRequest;

    const message =
      typeof body.message === "string" ? body.message.trim() : "";

    if (!message) {
      return sendError(res, 400, "Please enter a message.");
    }

    if (message.length > 12000) {
      return sendError(
        res,
        400,
        "Your message is too long. Please shorten it and try again.",
      );
    }

    const history = Array.isArray(body.history) ? body.history : [];

    // Keep only valid user/assistant messages and limit the history sent.
    const safeHistory = history
      .filter(
        (item) =>
          item &&
          (item.role === "user" || item.role === "model") &&
          Array.isArray(item.parts) &&
          item.parts.some(
            (part) => part && typeof part.text === "string",
          ),
      )
      .slice(-20)
      .map((item) => ({
        role: item.role === "model" ? "assistant" : "user",
        content: item.parts
          .map((part) => part.text)
          .join("\n")
          .slice(0, 12000),
      }))
      .filter((item) => item.content.trim().length > 0);

    // The chat page already includes the latest user message in history.
    // Only append it if it isn't already the last message.
    const lastMessage = safeHistory[safeHistory.length - 1];

    if (
      !lastMessage ||
      lastMessage.role !== "user" ||
      lastMessage.content.trim() !== message
    ) {
      safeHistory.push({
        role: "user",
        content: message,
      });
    }

    const userContext =
      typeof body.userContext === "string"
        ? body.userContext.slice(0, 10000)
        : "";

    const additionalInstruction =
      typeof body.systemInstruction === "string"
        ? body.systemInstruction.trim().slice(0, 2000)
        : "";

    const systemContent = [
      DEFAULT_SYSTEM_INSTRUCTION,
      additionalInstruction
        ? `\nAdditional instructions:\n${additionalInstruction}`
        : "",
      userContext
        ? `\nRelevant information from the user's SymptomSync account:\n${userContext}`
        : "\nNo user-specific health information was provided.",
    ].join("");

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "system",
              content: systemContent,
            },
            ...safeHistory,
          ],
          max_completion_tokens: 1200,
          stream: false,
        }),
      },
    );

    if (!groqResponse.ok) {
      const errorBody = await groqResponse.text();

      console.error("Groq API error:", groqResponse.status, errorBody);

      if (groqResponse.status === 429) {
        return sendError(
          res,
          429,
          "The AI assistant has reached its current usage limit. Please wait a little and try again.",
        );
      }

      if (groqResponse.status === 401 || groqResponse.status === 403) {
        return sendError(
          res,
          502,
          "The AI service could not authenticate the request. Check your Groq API key.",
        );
      }

      return sendError(
        res,
        502,
        "The AI assistant could not complete your request. Please try again.",
      );
    }

    const result = await groqResponse.json();

    const aiResponse = result.choices?.[0]?.message?.content;

    if (typeof aiResponse !== "string" || !aiResponse.trim()) {
      console.error("Groq returned an empty response:", result);

      return sendError(
        res,
        502,
        "The AI assistant returned an empty response. Please try again.",
      );
    }

    return res.status(200).json({
      text: aiResponse.trim(),
    });
  } catch (error) {
    console.error("Chat API error:", error);

    return sendError(
      res,
      500,
      "Something went wrong while contacting the AI assistant. Please try again.",
    );
  }
}