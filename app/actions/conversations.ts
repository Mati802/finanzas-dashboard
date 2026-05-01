'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import type { ToolActionSummary } from '@/lib/ai/tools';

export interface ConversationSummary {
  id: number;
  title: string;
  updatedAt: Date;
  lastMessage: string;
}

export interface ConversationMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  toolActions: ToolActionSummary[] | null;
  imageData: string | null;
  imageMediaType: string | null;
  createdAt: Date;
}

/**
 * Lista todas las conversaciones ordenadas por última actividad, con una
 * vista previa del último mensaje (para mostrar en el sidebar).
 */
export async function listConversations(): Promise<ConversationSummary[]> {
  const rows = await db.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true, role: true },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updatedAt,
    lastMessage: r.messages[0]?.content.slice(0, 80) ?? '',
  }));
}

/** Crea una conversación vacía y devuelve su id para que el cliente la abra. */
export async function createConversation(title?: string): Promise<number> {
  const c = await db.conversation.create({
    data: { title: title?.trim() || 'Nueva conversación' },
  });
  revalidatePath('/');
  return c.id;
}

/** Renombra una conversación (el asistente lo hace automáticamente tras el primer mensaje). */
export async function renameConversation(id: number, title: string): Promise<void> {
  await db.conversation.update({
    where: { id },
    data: { title: title.trim().slice(0, 120) || 'Nueva conversación' },
  });
}

/** Borra una conversación y todos sus mensajes (cascade en el schema). */
export async function deleteConversation(id: number): Promise<void> {
  await db.conversation.delete({ where: { id } });
  revalidatePath('/');
}

/** Devuelve todos los mensajes ordenados cronológicamente. */
export async function getConversationMessages(id: number): Promise<ConversationMessage[]> {
  const rows = await db.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((m) => {
    let toolActions: ToolActionSummary[] | null = null;
    if (m.toolActions) {
      try {
        toolActions = JSON.parse(m.toolActions) as ToolActionSummary[];
      } catch {
        toolActions = null;
      }
    }
    return {
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      toolActions,
      imageData: m.imageData,
      imageMediaType: m.imageMediaType,
      createdAt: m.createdAt,
    };
  });
}
