"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./art";

/** Accessible modal: traps initial focus, closes on Escape, restores focus. */
export function Modal({
  open,
  onClose,
  title,
  children,
  role = "dialog",
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  role?: "dialog" | "alertdialog";
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const autoId = useId();
  const titleId = labelledBy ?? autoId;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const first = ref.current?.querySelector<HTMLElement>("[data-autofocus], button, a, input");
      first?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center sm:items-center" role="presentation">
      <button aria-label="Close" className="absolute inset-0 bg-navy-950/60 backdrop-blur-[2px]" onClick={onClose} tabIndex={-1} />
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={title ? titleId : labelledBy}
        className="card animate-rise-in relative m-3 max-h-[88dvh] w-full max-w-md overflow-y-auto p-5 pb-safe"
      >
        {title ? (
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 id={titleId} className="font-display text-2xl font-semibold text-navy-900">
              {title}
            </h2>
            <button className="btn btn-cream !min-h-11 !min-w-11 !p-0" onClick={onClose} aria-label="Close">
              <Icon.Close size={22} />
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  return (
    <Modal open={open} onClose={onCancel} role="alertdialog" labelledBy={id}>
      <h2 id={id} className="font-display mb-2 text-2xl font-semibold text-navy-900">
        {title}
      </h2>
      <div className="mb-5 text-base text-ink-muted">{body}</div>
      <div className="flex flex-col gap-3">
        <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button className="btn btn-cream" onClick={onCancel} data-autofocus>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

export type CheckState = "pending" | "pass" | "fail" | "warn" | "skipped";

const CHECK_META: Record<CheckState, { label: string; cls: string; icon: ReactNode }> = {
  pending: { label: "Checking…", cls: "bg-navy-200/60 text-navy-900", icon: <span className="block h-5 w-5 animate-spin rounded-full border-[3px] border-navy-700 border-t-transparent" /> },
  pass: { label: "Passed", cls: "bg-ok-bg text-ok", icon: <Icon.Check size={22} /> },
  fail: { label: "Not yet", cls: "bg-bad-bg text-bad", icon: <Icon.Cross size={22} /> },
  warn: { label: "Unsure", cls: "bg-warn-bg text-warn", icon: <Icon.Question size={22} /> },
  skipped: { label: "Waiting", cls: "bg-cream-200 text-ink-muted", icon: <span aria-hidden className="text-lg font-bold">–</span> },
};

/** One verification check. Status is ALWAYS spelled out in text, not just colour. */
export function CheckRow({ title, state, detail }: { title: string; state: CheckState; detail?: ReactNode }) {
  const m = CHECK_META[state];
  return (
    <div className="flex gap-3 rounded-2xl border-2 border-cream-200 bg-white/70 p-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${m.cls}`}>{m.icon}</div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-lg font-semibold text-navy-900">{title}</span>
          <span className={`rounded-full px-2 py-0.5 text-sm font-bold ${m.cls}`}>{m.label}</span>
        </div>
        {detail ? <div className="mt-1 text-[15px] leading-snug text-ink">{detail}</div> : null}
      </div>
    </div>
  );
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => done.current(), 3800);
    return () => clearTimeout(t);
  }, [message]);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-safe z-[2500] flex justify-center px-4">
      {message ? (
        <div className="animate-rise-in mt-32 max-w-sm rounded-2xl bg-navy-900 px-4 py-3 text-center font-semibold text-white shadow-lg ring-2 ring-orange-500">{message}</div>
      ) : null}
    </div>
  );
}
