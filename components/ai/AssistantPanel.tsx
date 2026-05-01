'use client';

import * as React from 'react';
import {
  Loader2,
  Send,
  Sparkles,
  ImagePlus,
  Plus,
  Trash2,
  MessageSquare,
  Wrench,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  sendChatMessage,
  getAssistantEnabled,
} from '@/app/actions/ai';
import {
  listConversations,
  createConversation,
  deleteConversation,
  getConversationMessages,
  type ConversationSummary,
  type ConversationMessage,
} from '@/app/actions/conversations';
import type { ToolActionSummary } from '@/lib/ai/tools';
import { cn } from '@/lib/utils';

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
type AllowedMime = (typeof ALLOWED_MIME)[number];

export interface AssistantPanelProps {
  /** Hint inicial desde el server. Se revalida en el cliente al abrir el panel. */
  enabled: boolean;
}

interface ViewMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  toolActions?: ToolActionSummary[] | null;
  imageData?: string | null;
  imageMediaType?: string | null;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  // btoa acepta binary strings, lo armamos byte a byte.
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function relativeTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'hace segundos';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

function ToolChip({ action }: { action: ToolActionSummary }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
      <Wrench className="h-2.5 w-2.5" />
      <span>{action.label}</span>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  toolActions,
  imageData,
  imageMediaType,
  pending,
}: ViewMessage & { pending?: boolean }) {
  const mine = role === 'user';
  return (
    <div className={cn('flex flex-col gap-1.5', mine ? 'items-end' : 'items-start')}>
      {imageData && imageMediaType ? (
        <img
          src={`data:${imageMediaType};base64,${imageData}`}
          alt="adjunto"
          className="max-w-[220px] rounded-lg border border-border-subtle"
        />
      ) : null}
      {(content || pending) && (
        <div
          className={cn(
            'max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12px] leading-[1.5]',
            mine ? 'bg-[#8b5cf6]/20 text-fg' : 'bg-bg-sunken text-fg'
          )}
        >
          {pending ? (
            <span className="inline-flex items-center gap-1.5 text-fg-subtle">
              <Loader2 className="h-3 w-3 animate-spin" /> Pensando…
            </span>
          ) : (
            content
          )}
        </div>
      )}
      {toolActions && toolActions.length > 0 ? (
        <div className="flex max-w-[85%] flex-wrap gap-1">
          {toolActions.map((a, i) => (
            <ToolChip key={i} action={a} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AssistantPanel({ enabled: initialEnabled }: AssistantPanelProps) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [enabled, setEnabled] = React.useState<boolean>(initialEnabled);

  // Sidebar state
  const [conversations, setConversations] = React.useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = React.useState<number | null>(null);
  const [loadingList, setLoadingList] = React.useState(false);

  // Chat state
  const [messages, setMessages] = React.useState<ViewMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Re-chequear la key al abrir (cambios en .env sin rebuild).
  React.useEffect(() => {
    if (!open) return;
    getAssistantEnabled()
      .then((v) => setEnabled(v))
      .catch(() => {});
  }, [open]);

  // Cargar conversaciones al abrir.
  const refreshList = React.useCallback(async () => {
    setLoadingList(true);
    try {
      const list = await listConversations();
      setConversations(list);
      return list;
    } finally {
      setLoadingList(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open || !enabled) return;
    refreshList().then((list) => {
      // Si no hay conversación activa, abrir la más reciente o crear una nueva.
      if (activeId == null) {
        if (list.length > 0) setActiveId(list[0].id);
        else {
          createConversation()
            .then((id) => {
              setActiveId(id);
              refreshList();
            })
            .catch(() => {});
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, enabled]);

  // Cargar mensajes cuando cambia la conversación activa.
  React.useEffect(() => {
    if (activeId == null) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    getConversationMessages(activeId)
      .then((rows: ConversationMessage[]) => {
        if (cancelled) return;
        setMessages(
          rows.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            toolActions: m.toolActions,
            imageData: m.imageData,
            imageMediaType: m.imageMediaType,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // Auto-scroll al final cuando hay mensajes nuevos.
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  async function handleNewChat() {
    try {
      const id = await createConversation();
      setActiveId(id);
      setInput('');
      setMessages([]);
      await refreshList();
    } catch {
      toast({ title: 'Error', description: 'No se pudo crear la conversación', variant: 'destructive' });
    }
  }

  async function handleDeleteChat(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (pending) return;
    try {
      await deleteConversation(id);
      const list = await refreshList();
      if (activeId === id) {
        if (list.length > 0) setActiveId(list[0].id);
        else {
          const newId = await createConversation();
          setActiveId(newId);
          await refreshList();
        }
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo borrar', variant: 'destructive' });
    }
  }

  async function sendMessage(params: { text: string; image?: { data: string; mediaType: AllowedMime } }) {
    if (activeId == null) return;
    const text = params.text.trim();
    if (!text && !params.image) return;
    if (pending) return;

    // Optimistic add del mensaje del usuario.
    const optimistic: ViewMessage = {
      role: 'user',
      content: text || (params.image ? '(imagen adjunta)' : ''),
      imageData: params.image?.data ?? null,
      imageMediaType: params.image?.mediaType ?? null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput('');
    setPending(true);
    try {
      const res = await sendChatMessage({
        conversationId: activeId,
        userText: text,
        image: params.image,
      });
      if (res.error && !res.reply) {
        toast({ title: 'Asistente', description: res.error, variant: 'destructive' });
        // Dejamos el user message optimista pero mostramos el error.
      }
      if (res.reply || res.toolActions.length) {
        setMessages((prev) => [
          ...prev,
          {
            id: res.messageId,
            role: 'assistant',
            content: res.reply,
            toolActions: res.toolActions,
          },
        ]);
      }
      // Si era el primer turno, el título puede haber cambiado — refresco la lista.
      await refreshList();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Falló la consulta',
        variant: 'destructive',
      });
    } finally {
      setPending(false);
    }
  }

  async function onUploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type as AllowedMime)) {
      toast({
        title: 'Formato no soportado',
        description: 'Subí una imagen PNG, JPG, WEBP o GIF.',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({
        title: 'Imagen demasiado grande',
        description: 'Máximo 8 MB por captura.',
        variant: 'destructive',
      });
      return;
    }
    const base64 = await fileToBase64(file);
    await sendMessage({
      text: input,
      image: { data: base64, mediaType: file.type as AllowedMime },
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage({ text: input });
    }
  }

  const activeConversation = conversations.find((c) => c.id === activeId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className={cn(
            'fixed bottom-5 right-5 z-40 h-11 gap-2 rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] px-4 text-white shadow-lg',
            'hover:opacity-90'
          )}
          aria-label="Abrir asistente"
        >
          <Sparkles className="h-4 w-4" />
          <span className="text-[11px] font-semibold">Asistente</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[640px] max-h-[90vh] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0">
        {/* Accesibilidad: DialogTitle oculto para screen readers; la header visible ya incluye el nombre. */}
        <DialogTitle className="sr-only">Asistente financiero</DialogTitle>

        {!enabled ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-[12px] text-fg-muted">
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-fg">
                <Sparkles className="h-4 w-4 text-[#a78bfa]" />
                <span className="font-semibold">Asistente desactivado</span>
              </div>
              <p className="text-fg-subtle">
                Agregá{' '}
                <code className="rounded bg-bg-sunken px-1.5 py-0.5 text-[10px]">
                  FINANZAS_AI_KEY
                </code>{' '}
                (o{' '}
                <code className="rounded bg-bg-sunken px-1.5 py-0.5 text-[10px]">
                  ANTHROPIC_API_KEY
                </code>
                ) en{' '}
                <code className="rounded bg-bg-sunken px-1.5 py-0.5 text-[10px]">.env.local</code>{' '}
                y reiniciá el servidor.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full">
            {/* Sidebar de conversaciones */}
            <aside className="flex w-[220px] shrink-0 flex-col border-r border-border-subtle bg-bg-sunken">
              <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-3">
                <Sparkles className="h-4 w-4 text-[#a78bfa]" />
                <span className="text-[12px] font-semibold text-fg">Chats</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-7 w-7"
                  onClick={handleNewChat}
                  disabled={pending}
                  aria-label="Nuevo chat"
                  title="Nuevo chat"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-1 py-1">
                {loadingList && conversations.length === 0 ? (
                  <div className="flex items-center justify-center py-6 text-fg-subtle">
                    <Loader2 className="h-3 w-3 animate-spin" />
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="px-2 py-3 text-[11px] text-fg-subtle">
                    Aún no hay chats. Creá uno con el botón +.
                  </p>
                ) : (
                  conversations.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveId(c.id)}
                      className={cn(
                        'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition',
                        c.id === activeId
                          ? 'bg-[#8b5cf6]/15 text-fg'
                          : 'text-fg-muted hover:bg-bg-elevated hover:text-fg'
                      )}
                    >
                      <MessageSquare className="h-3 w-3 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-medium">{c.title}</p>
                        <p className="truncate text-[10px] text-fg-subtle">
                          {c.lastMessage || relativeTime(c.updatedAt)}
                        </p>
                      </div>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleDeleteChat(c.id, e)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleDeleteChat(c.id, e as unknown as React.MouseEvent);
                          }
                        }}
                        className="hidden h-6 w-6 items-center justify-center rounded hover:bg-red-500/20 hover:text-red-400 group-hover:inline-flex"
                        aria-label={`Borrar ${c.title}`}
                        title="Borrar"
                      >
                        <Trash2 className="h-3 w-3" />
                      </span>
                    </button>
                  ))
                )}
              </div>
            </aside>

            {/* Panel del chat activo */}
            <section className="flex min-w-0 flex-1 flex-col">
              <header className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-fg">
                    {activeConversation?.title ?? 'Nueva conversación'}
                  </p>
                  <p className="text-[10px] text-fg-subtle">
                    Claude con acceso a tus datos — puede leer, agregar y crear categorías automáticamente.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </header>

              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-8 text-fg-subtle">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                    <Sparkles className="h-6 w-6 text-[#a78bfa]" />
                    <p className="text-[13px] font-semibold text-fg">¿En qué te ayudo?</p>
                    <p className="max-w-sm text-[11px] text-fg-subtle">
                      Preguntame por tus finanzas, o subí una captura de una transacción
                      y la cargo automáticamente en tus gastos o ingresos.
                    </p>
                  </div>
                ) : (
                  messages.map((m, i) => <MessageBubble key={m.id ?? i} {...m} />)
                )}
                {pending && <MessageBubble role="assistant" content="" pending />}
              </div>

              <div className="border-t border-border-subtle bg-bg-sunken px-5 py-3">
                <div className="flex items-end gap-2">
                  <label
                    className={cn(
                      'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-fg-muted hover:text-fg',
                      pending && 'pointer-events-none opacity-50'
                    )}
                    title="Adjuntar imagen"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={onUploadImage}
                      disabled={pending}
                    />
                  </label>
                  <Textarea
                    placeholder="Escribí tu consulta o subí una captura… (Shift+Enter = nueva línea)"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    rows={1}
                    disabled={pending}
                    className="min-h-[36px] flex-1 resize-none text-[12px]"
                  />
                  <Button
                    onClick={() => sendMessage({ text: input })}
                    disabled={pending || !input.trim()}
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    aria-label="Enviar"
                  >
                    {pending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <p className="mt-1.5 text-[10px] text-fg-subtle">
                  Las conversaciones quedan guardadas en tu base local. Claude puede crear transacciones,
                  categorías y activos automáticamente.
                </p>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
