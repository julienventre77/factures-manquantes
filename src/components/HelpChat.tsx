import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Bot, Send, Forward, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { getChatHistory, sendChatMessage, forwardQuestion } from "@/lib/assistant.functions";

type Msg = { id: string; role: string; content: string; escalate?: boolean; question?: string };

export function HelpChat({ groupKey }: { groupKey?: string | null }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const hist = useServerFn(getChatHistory);
  const send = useServerFn(sendChatMessage);
  const fwd = useServerFn(forwardQuestion);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    hist().then((r) => { setMsgs(r.messages); setRemaining(r.remaining); }).catch(() => {});
    setTimeout(() => taRef.current?.focus(), 50);
  }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);

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

  async function forward(m: Msg) {
    try {
      await fwd({ data: { question: m.question!, groupKey: groupKey ?? null } });
      setSent((s) => new Set(s).add(m.id));
      toast.success("Votre question a été transmise au cabinet.");
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Ouvrir l'assistant"
        title="Besoin d'aide ?"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-200 hover:scale-110 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Bot className="h-7 w-7" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b p-4">
            <SheetTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> Assistant PBC List</SheetTitle>
            <SheetDescription>Je vous guide pour transmettre vos factures.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.length === 0 && (
              <p className="text-sm text-muted-foreground">Posez votre question, par exemple : « Où trouver ma facture ? » ou « Que faire si je n'ai pas la facture ? »</p>
            )}
            {msgs.map((m) => (
              <div key={m.id} className={m.role === "user" ? "ml-8 rounded-lg bg-primary p-3 text-sm text-primary-foreground" : "mr-4 text-sm"}>
                {m.role === "user" ? m.content : (
                  <div className="prose prose-sm max-w-none text-foreground"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                )}
                {m.escalate && m.question && (
                  <Button size="sm" variant="outline" className="mt-2" disabled={sent.has(m.id)} onClick={() => forward(m)}>
                    <Forward /> {sent.has(m.id) ? "Question transmise" : "Transmettre ma question au cabinet"}
                  </Button>
                )}
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> L'assistant écrit…</div>}
            <div ref={endRef} />
          </div>
          <div className="border-t p-4 space-y-2">
            <div className="flex gap-2">
              <Textarea ref={taRef} value={input} rows={2} placeholder="Votre question…" disabled={remaining === 0}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} />
              <Button size="icon" className="h-auto w-12 shrink-0" onClick={submit} disabled={busy || !input.trim() || remaining === 0} aria-label="Envoyer"><Send /></Button>
            </div>
            {remaining != null && <p className="text-xs text-muted-foreground">{remaining} message(s) restant(s) aujourd'hui.</p>}
            <p className="text-xs text-muted-foreground">Vos questions sont traitées par un service d'intelligence artificielle (Anthropic). Ne saisissez pas de données sensibles.</p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
