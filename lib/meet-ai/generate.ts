// R1.5 meet AI — browser-direct inference. The ONLY file in lib/meet-ai that
// calls fetch (gate-pinned), and the calls go to the OWNER's provider with the
// OWNER's credential — never to a PX endpoint. PX runs no model and relays
// nothing (precedent: AiAssistPanel; the Anthropic call uses the documented
// browser-direct header).

import type { MeetModel } from "./models.ts";

export type GenerateInput = {
  model: MeetModel;
  apiKey: string; // openai/anthropic — ignored for ollama
  endpoint: string; // ollama — ignored otherwise
  prompt: string;
};

export type GenerateResult =
  | { ok: true; text: string }
  | { ok: false; error: "auth" | "rate" | "provider" | "network" };

function failFrom(status: number): GenerateResult {
  if (status === 401 || status === 403) return { ok: false, error: "auth" };
  if (status === 429) return { ok: false, error: "rate" };
  return { ok: false, error: "provider" };
}

/**
 * Reachability probe for the local lane (fix: 「つながっています」 is said only
 * after this succeeds — never assumed). Returns the installed model names so
 * the picker offers what the machine actually has.
 */
export async function probeOllama(
  endpoint: string,
): Promise<{ ok: true; models: string[] } | { ok: false }> {
  const base = (endpoint.trim() || "http://localhost:11434").replace(/\/+$/, "");
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${base}/api/tags`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return { ok: false };
    const body = (await res.json()) as { models?: Array<{ name?: string }> };
    const models = (body.models ?? [])
      .map((m) => (typeof m.name === "string" ? m.name : ""))
      .filter((n) => n !== "");
    return { ok: true, models };
  } catch {
    return { ok: false };
  }
}

export async function generateProposals(input: GenerateInput): Promise<GenerateResult> {
  try {
    if (input.model.provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": input.apiKey,
          "anthropic-version": "2023-06-01",
          // Documented opt-in for calling the API straight from a browser with
          // the user's OWN key (exactly this architecture).
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: input.model.id,
          max_tokens: 2000,
          messages: [{ role: "user", content: input.prompt }],
        }),
      });
      if (!res.ok) return failFrom(res.status);
      const body = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
      const text = (body.content ?? [])
        .map((c) => (typeof c.text === "string" ? c.text : ""))
        .join("");
      return text.trim() === "" ? { ok: false, error: "provider" } : { ok: true, text };
    }

    if (input.model.provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.apiKey}`,
        },
        body: JSON.stringify({
          model: input.model.id,
          messages: [{ role: "user", content: input.prompt }],
        }),
      });
      if (!res.ok) return failFrom(res.status);
      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = body.choices?.[0]?.message?.content ?? "";
      return text.trim() === "" ? { ok: false, error: "provider" } : { ok: true, text };
    }

    // ollama — local endpoint, no key
    const base = (input.endpoint.trim() || "http://localhost:11434").replace(/\/+$/, "");
    const res = await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: input.model.id.replace(/^ollama:/, ""),
        prompt: input.prompt,
        stream: false,
      }),
    });
    if (!res.ok) return failFrom(res.status);
    const body = (await res.json()) as { response?: string };
    const text = body.response ?? "";
    return text.trim() === "" ? { ok: false, error: "provider" } : { ok: true, text };
  } catch {
    return { ok: false, error: "network" };
  }
}
