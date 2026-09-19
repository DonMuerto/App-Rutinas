import { useEffect, useRef, type ReactNode } from "react";

import { IconButton } from "./button";
import { Icon } from "./icon";

function focusableElements(root: HTMLElement | null) {
  if (!root) return [];

  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function Dialog({
  children,
  descriptionId,
  labelId,
  onClose,
  open,
}: {
  readonly children: ReactNode;
  readonly descriptionId?: string;
  readonly labelId: string;
  readonly onClose: () => void;
  readonly open: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => focusableElements(panelRef.current)[0]?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const controls = focusableElements(panelRef.current);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="ui-dialog-layer">
      <button
        aria-label="Cerrar dialogo"
        className="ui-dialog-backdrop"
        onClick={onClose}
        type="button"
      />
      <div
        aria-describedby={descriptionId}
        aria-labelledby={labelId}
        aria-modal="true"
        className="ui-dialog-panel"
        ref={panelRef}
        role="dialog"
      >
        <IconButton
          className="ui-dialog-close"
          label="Cerrar dialogo"
          onClick={onClose}
        >
          <Icon height="20" name="close" width="20" />
        </IconButton>
        {children}
      </div>
    </div>
  );
}
