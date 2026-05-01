'use client';
// Minimal toast hook — inspired by shadcn/ui but simplified for this project.
import * as React from 'react';
import type { ToastProps } from './toast';

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
};

type State = { toasts: ToasterToast[] };
type Action =
  | { type: 'ADD'; toast: ToasterToast }
  | { type: 'REMOVE'; id?: string }
  | { type: 'UPDATE'; toast: Partial<ToasterToast> & { id: string } };

const listeners = new Set<(s: State) => void>();
let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((l) => l(memoryState));
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD':
      return { toasts: [action.toast, ...state.toasts].slice(0, 4) };
    case 'REMOVE':
      return { toasts: action.id ? state.toasts.filter((t) => t.id !== action.id) : [] };
    case 'UPDATE':
      return {
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };
  }
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

type ToastInput = Omit<ToasterToast, 'id'>;

export function toast(props: ToastInput) {
  const id = genId();
  const dismiss = () => dispatch({ type: 'REMOVE', id });
  dispatch({ type: 'ADD', toast: { ...props, id, open: true, onOpenChange: (o) => !o && dismiss() } });
  setTimeout(dismiss, 5000);
  return { id, dismiss };
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);
  React.useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return {
    ...state,
    toast,
    dismiss: (id?: string) => dispatch({ type: 'REMOVE', id }),
  };
}
