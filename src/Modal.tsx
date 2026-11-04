import { ReactNode, useEffect, useId, useRef } from "react";
import "./modal.css";

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    close = useRef(onClose),
    // Capture before this render makes the invoking workspace inert.
    previous = useRef(document.activeElement as HTMLElement | null),
    id = useId();
  close.current = onClose;
  useEffect(() => {
    const items = () =>
      Array.from(
        ref.current!.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
        ),
      );
    (items().find((e) => e.tagName === "INPUT") ?? items()[0])?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close.current();
      }
      // WebKitGTK can report Shift+Tab as Unidentified while retaining its code.
      if (e.key === "Tab" || (e.key === "Unidentified" && e.code === "Tab")) {
        const all = items(),
          first = all[0],
          last = all.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    const node = ref.current!;
    node.addEventListener("keydown", key);
    return () => {
      node.removeEventListener("keydown", key);
      if (previous.current?.isConnected) previous.current.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
      >
        <div className="section-heading">
          <h2 id={id}>{title}</h2>
          <button aria-label="Dialog schließen" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
