"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Loader2, User, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function BotAvatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
      <Bot className="size-4 text-white" />
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 shadow-md">
      <User className="size-4 text-white" />
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <BotAvatar />
      <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="size-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
          <span className="size-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
          <span className="size-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
        <Sparkles className="size-7 text-white" />
      </div>
      <div className="space-y-2 text-center">
        <h3 className="text-base font-semibold">Assistant PMO IA</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Posez vos questions sur les chantiers, actions, risques, comités et plus encore.
        </p>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {[
          "Actions en retard ?",
          "Prochains comités ?",
          "Risques critiques ?",
        ].map((suggestion) => (
          <span
            key={suggestion}
            className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground"
          >
            {suggestion}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "0px";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? data.error ?? "Erreur inconnue." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Erreur de connexion au serveur." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="group fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
      >
        <Bot className="size-6 text-white transition-transform group-hover:scale-110" />
        <span className="absolute -top-1 -right-1 flex size-4">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex size-4 rounded-full bg-blue-300" />
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex w-[420px] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <Bot className="size-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Assistant PMO IA</h3>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] text-blue-100">En ligne</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setMessages([])}
              className="text-white/70 hover:bg-white/15 hover:text-white"
              title="Effacer la conversation"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setOpen(false)}
            className="text-white/70 hover:bg-white/15 hover:text-white"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex flex-col gap-4 overflow-y-auto p-4"
        style={{ maxHeight: 400, minHeight: 200 }}
      >
        {messages.length === 0 && <WelcomeScreen />}

        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <div key={i} className="flex items-start justify-end gap-3">
              <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-blue-500 to-indigo-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm whitespace-pre-wrap">
                {msg.content}
              </div>
              <UserAvatar />
            </div>
          ) : (
            <div key={i} className="flex items-start gap-3">
              <BotAvatar />
              <div className="max-w-[80%] rounded-2xl rounded-tl-sm border bg-muted/50 px-4 py-2.5 text-sm leading-relaxed shadow-sm whitespace-pre-wrap">
                {msg.content}
              </div>
            </div>
          )
        )}

        {loading && <TypingIndicator />}
      </div>

      {/* Input */}
      <div className="border-t bg-background/80 p-3 backdrop-blur-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-2 rounded-xl border bg-card px-3 py-2 shadow-sm transition-colors focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Posez votre question..."
            disabled={loading}
            rows={1}
            className="max-h-[120px] flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
          />
          <Button
            type="submit"
            size="icon-xs"
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm transition-all hover:shadow-md disabled:from-muted disabled:to-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </Button>
        </form>
        <p className="mt-2 text-center text-[10px] text-muted-foreground/50">
          Propulsé par IA — Les réponses se basent sur vos données PMO
        </p>
      </div>
    </div>
  );
}
