import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, Send, Forward, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import { getChatHistory, sendChatMessage, forwardQuestion } from "@/lib/assistant.functions";

export type ChatMsg = { id: string; role: string; content: string; escalate?: boolean; question?: string };

// Client assistant. `raised` lifts the robot above a fixed bottom bar.
export function HelpChat({ groupKey, raised = false }: { groupKey?: string | null; raised?: boolean }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const hist = useServerFn(getChatHistory);
  const send = useServerFn(sendChatMessage);
  const fwd = useServerFn(forwardQuestion);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    hist().then((r) => { setMsgs(r.messages); setRemaining(r.remaining); }).catch(() => {});
    setTimeout(() => taRef.current?.focus(), 50);
  }, [open]);

  async function submit() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "user", content: q }]);
    setBusy(true);
    try {
      const r = await send({ data: { message: q, groupKey: groupKey ?? null } });
      setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: r.reply, escalate: r.escalate, question: q }]);
      setRemaining((n) => (n == null ? n : Math.max(0, n - 1)));
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
      taRef.current?.focus();
    }
  }

  async function forward(m: ChatMsg) {
    try {
      await fwd({ data: { question: m.question!, groupKey: groupKey ?? null } });
      setSent((s) => new Set(s).add(m.id));
      toast.success("Votre question a été transmise au cabinet.");
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  }

  return (
    <>
      <RobotButton raised={raised} onClick={() => setOpen(true)} />
      <ChatPanel
        open={open}
        onOpenChange={setOpen}
        description="Je vous guide pour transmettre vos factures."
        emptyHint="Posez votre question, par exemple : « Où trouver ma facture ? » ou « Que faire si je n'ai pas la facture ? »"
        msgs={msgs}
        busy={busy}
        input={input}
        onInput={setInput}
        onSubmit={submit}
        remaining={remaining}
        taRef={taRef}
        privacyNote="Vos questions, et sur la page d'un fournisseur ou d'un client ses paiements (dates, montants, libellés sans IBAN), sont traités par un service d'intelligence artificielle (Anthropic). Ne saisissez pas de données sensibles."
        renderExtra={(m) =>
          m.escalate && m.question ? (
            <Button size="sm" variant="outline" className="mt-2" disabled={sent.has(m.id)} onClick={() => forward(m)}>
              <Forward /> {sent.has(m.id) ? "Question transmise" : "Transmettre ma question au cabinet"}
            </Button>
          ) : null
        }
      />
    </>
  );
}

// The little robot in the bottom right corner, shared by both spaces.
export function RobotButton({ raised = false, onClick }: { raised?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Besoin d'aide ? Ouvrir l'assistant"
      onClick={onClick}
      className={`group fixed right-5 z-40 flex items-center gap-3 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${raised ? "bottom-24" : "bottom-5"}`}
    >
      <span className="hidden rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg sm:block">Besoin d'aide ?</span>
      <span className="relative flex h-14 w-14 items-center justify-center rounded-full border-4 border-card bg-primary text-mint shadow-lg transition-transform duration-200 group-hover:scale-110">
        <Bot className="h-7 w-7" />
        <span aria-hidden className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-mint" />
      </span>
    </button>
  );
}

export function ChatPanel({
  open, onOpenChange, description, emptyHint, suggestions, onSuggestion, msgs, busy, input, onInput, onSubmit, remaining, taRef, privacyNote, renderExtra,
}: {
  open: boolean; onOpenChange: (open: boolean) => void; description: string; emptyHint: string;
  suggestions?: string[] | undefined; onSuggestion?: ((text: string) => void) | undefined;
  msgs: ChatMsg[]; busy: boolean; input: string; onInput: (v: string) => void; onSubmit: () => void;
  remaining: number | null; taRef: RefObject<HTMLTextAreaElement | null>; privacyNote: string;
  renderExtra?: ((m: ChatMsg) => ReactNode) | undefined;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2 text-primary">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-mint"><Bot className="h-5 w-5" /></span>
            Assistant PBC List
          </SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {msgs.length === 0 && (
            <>
              <p className="text-sm text-muted-foreground">{emptyHint}</p>
              {suggestions && onSuggestion && (
                <div className="flex flex-col items-start gap-2">
                  {suggestions.map((s) => (
                    <Button key={s} size="sm" variant="outline" className="h-auto whitespace-normal py-1.5 text-left" disabled={busy || remaining === 0} onClick={() => onSuggestion(s)}>
                      {s}
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}
          {msgs.map((m) => (
            <div key={m.id} className={m.role === "user" ? "ml-8 rounded-2xl rounded-br-md bg-primary p-3 text-sm text-primary-foreground" : "mr-4 rounded-2xl rounded-bl-md bg-pale-2 p-3 text-sm"}>
              {m.role === "user" ? m.content : (
                <div className="text-foreground [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_h1]:mt-2 [&_h2]:mt-2 [&_h3]:mt-2 [&_li+li]:mt-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"><SafeMarkdown>{m.content}</SafeMarkdown></div>
              )}
              {renderExtra?.(m)}
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> L'assistant écrit…</div>}
          <div ref={endRef} />
        </div>
        <div className="border-t p-4 space-y-2">
          <div className="flex gap-2">
            <Textarea ref={taRef} value={input} rows={2} placeholder="Votre question…" disabled={remaining === 0} aria-label="Votre question"
              onChange={(e) => onInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); } }} />
            <Button size="icon" className="h-auto w-12 shrink-0" onClick={onSubmit} disabled={busy || !input.trim() || remaining === 0} aria-label="Envoyer"><Send /></Button>
          </div>
          {remaining != null && <p className="text-xs text-muted-foreground">{remaining} message(s) restant(s) aujourd'hui.</p>}
          <p className="text-xs text-muted-foreground">{privacyNote}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
