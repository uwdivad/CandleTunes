import { useRef, useState } from "react";

import { useAssistantChat, useAssistantFeedback } from "../api/queries";
import type { AssistantChatMessage, AssistantSettings } from "../api/types";
import { useAuthStore } from "../state/authStore";

interface Props {
  tickers: string[];
  dateRange: { start: string; end: string };
  currentSettings: AssistantSettings;
  onApply: (settings: AssistantSettings) => void;
}

// One transcript entry. Assistant entries carry the run_id so feedback can
// reference them; both track an optional rating once given.
interface Entry {
  role: "user" | "assistant";
  content: string;
  runId?: string;
  rating?: "up" | "down";
}

export function AssistantPanel({ tickers, dateRange, currentSettings, onApply }: Props) {
  const idToken = useAuthStore((s) => s.idToken);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const conversationId = useRef(crypto.randomUUID());

  const chat = useAssistantChat();
  const feedback = useAssistantFeedback();

  const signedIn = !!idToken;
  const hasTickers = tickers.length > 0;
  const isFirstTurn = entries.length === 0;
  const disabled = !signedIn || !hasTickers || chat.isPending;

  const send = () => {
    const text = input.trim();
    if (!text || disabled) return;

    const history: AssistantChatMessage[] = [
      ...entries.map((e) => ({ role: e.role, content: e.content })),
      { role: "user" as const, content: text },
    ];
    setEntries((prev) => [...prev, { role: "user", content: text }]);
    setInput("");

    chat.mutate(
      {
        tickers,
        start: dateRange.start,
        end: dateRange.end,
        messages: history,
        current_settings: currentSettings,
        conversation_id: conversationId.current,
      },
      {
        onSuccess: (res) => {
          setEntries((prev) => [
            ...prev,
            { role: "assistant", content: res.message, runId: res.run_id },
          ]);
          onApply(res.settings);
        },
      }
    );
  };

  const rate = (index: number, rating: "up" | "down") => {
    const entry = entries[index];
    if (!entry?.runId) return;
    feedback.mutate({ run_id: entry.runId, rating });
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, rating } : e)));
  };

  const newChat = () => {
    conversationId.current = crypto.randomUUID();
    setEntries([]);
    setInput("");
    chat.reset();
  };

  return (
    <div className="assistant-panel">
      <div className="assistant-header">
        <h3>Arranger</h3>
        {entries.length > 0 && (
          <button type="button" className="assistant-newchat" onClick={newChat}>
            New
          </button>
        )}
      </div>

      {!signedIn ? (
        <p className="assistant-hint">Sign in to use the arranger.</p>
      ) : !hasTickers ? (
        <p className="assistant-hint">Add a ticker to get started.</p>
      ) : (
        <>
          <div className="assistant-transcript">
            {entries.length === 0 && (
              <p className="assistant-hint">
                Describe a mood or genre and I'll arrange your tickers — then chat to refine.
              </p>
            )}
            {entries.map((e, i) => (
              <div key={i} className={`assistant-bubble assistant-bubble-${e.role}`}>
                <span>{e.content}</span>
                {e.role === "assistant" && e.runId && (
                  <div className="assistant-feedback">
                    <button
                      type="button"
                      className={e.rating === "up" ? "rated" : ""}
                      aria-label="Good arrangement"
                      onClick={() => rate(i, "up")}
                    >
                      👍
                    </button>
                    <button
                      type="button"
                      className={e.rating === "down" ? "rated" : ""}
                      aria-label="Bad arrangement"
                      onClick={() => rate(i, "down")}
                    >
                      👎
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {chat.isError && (
            <p className="error">{(chat.error as Error).message}</p>
          )}

          <div className="assistant-input-row">
            <input
              type="text"
              value={input}
              placeholder={isFirstTurn ? "e.g. calm lo-fi" : "Refine, e.g. more energetic"}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              disabled={chat.isPending}
            />
            <button type="button" onClick={send} disabled={disabled || !input.trim()}>
              {chat.isPending ? "…" : isFirstTurn ? "Generate" : "Send"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
