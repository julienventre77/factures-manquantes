import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChatPanel, RobotButton, type ChatMsg } from "@/components/HelpChat";
import { getCabinetChatHistory, sendCabinetChatMessage } from "@/lib/cabinet-assistant.functions";

// Cabinet assistant: on a dossier page it knows that dossier's open lines, on the list it knows the portfolio.
export function CabinetChat({ dossierId }: { dossierId: string | null }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const hist = useServerFn(getCabinetChatHistory);
  const send = useServerFn(sendCabinetChatMessage);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    hist({ data: { dossierId } }).then((r) => { setMsgs(r.messages); setRemaining(r.remaining); }).catch(() => {});
    setTimeout(() => taRef.current?.focus(), 50);
  }, [open, dossierId]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "user", content: q }]);
    setBusy(true);
    try {
      const r = await send({ data: { message: q, dossierId } });
      setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: r.reply }]);
      setRemaining((n) => (n == null ? n : Math.max(0, n - 1)));
    } catch (e) {
      toast.error((e as Error).message ?? "Erreur");
    } finally {
      setBusy(false);
      taRef.current?.focus();
    }
  }

  return (
    <>
      <RobotButton onClick={() => setOpen(true)} />
      <ChatPanel
        open={open}
        onOpenChange={setOpen}
        description={dossierId ? "Je vous aide sur ce dossier : résumé, lignes à écarter, relance du client." : "Je vous aide à suivre vos dossiers."}
        emptyHint="Posez votre question ou choisissez une suggestion :"
        suggestions={
          dossierId
            ? ["Résume l'état de ce dossier.", "Quelles lignes semblent ne pas demander de facture ?", "Rédige une relance courte et polie pour le client."]
            : ["Quels dossiers demandent mon attention en premier ?", "Comment fonctionne la synchronisation avec Pennylane ?"]
        }
        onSuggestion={ask}
        msgs={msgs}
        busy={busy}
        input={input}
        onInput={setInput}
        onSubmit={() => ask(input)}
        remaining={remaining}
        taRef={taRef}
        privacyNote={
          dossierId
            ? "Vos questions et les données du dossier (nom, adresses de collecte, lignes : dates, montants, tiers, libellés sans IBAN) sont traitées par un service d'intelligence artificielle (Anthropic). Vérifiez toujours ses réponses."
            : "Vos questions et la liste de vos dossiers (noms des clients et compteurs) sont traitées par un service d'intelligence artificielle (Anthropic). Vérifiez toujours ses réponses."
        }
      />
    </>
  );
}
