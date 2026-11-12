import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

interface RangeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  scale?: "linear" | "log";
  onCommit: (value: number) => void;
  /** Selected object properties commit once per gesture, not once per sample. */
  live?: boolean;
}

const valueFormat = new Intl.NumberFormat("de-DE", {
  maximumSignificantDigits: 6,
});
const rangeKeys = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

/** A slider owns only its unfinished UI draft; the controller owns effective values. */
export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  scale = "linear",
  onCommit,
  live = true,
}: RangeFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<number | null>(null);
  const pending = useRef<number | null>(null);
  const pointer = useRef(false);
  const keyboard = useRef(false);
  const cancelledPointer = useRef(false);
  const [exact, setExact] = useState<string | null>(null);
  const editing = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const exactInput = useRef<HTMLInputElement>(null);
  const valueButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const isLog = scale === "log";
  const displayed = draft ?? value;
  const position = (number: number) =>
    isLog ? (Math.log(number / min) / Math.log(max / min)) * 1000 : number;
  const fromPosition = (number: number) => {
    if (!isLog) return number;
    if (number <= 0) return min;
    if (number >= 1000) return max;
    return Number((min * (max / min) ** (number / 1000)).toPrecision(6));
  };
  const formatted = (number: number) =>
    `${valueFormat.format(number)}${unit ? ` ${unit}` : ""}`;
  const progress = isLog
    ? position(displayed) / 10
    : ((displayed - min) / (max - min)) * 100;

  useEffect(() => {
    if (exact !== null && editing.current) {
      exactInput.current?.focus();
      exactInput.current?.select();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      valueButton.current?.focus();
    }
    // Select the value only when the precise editor opens, not on every keystroke.
  }, [exact === null]);

  const clearDraft = () => {
    pending.current = null;
    pointer.current = false;
    keyboard.current = false;
    setDraft(null);
  };
  const commitRange = () => {
    const next = pending.current;
    clearDraft();
    if (!live && next !== null && next !== value) onCommit(next);
  };
  const closeExact = (focus: boolean) => {
    editing.current = false;
    returnFocus.current = focus;
    setExact(null);
    setError(null);
  };
  const commitExact = (focus: boolean) => {
    if (!editing.current || exact === null) return;
    const text = exact.trim();
    if (!text) {
      closeExact(focus);
      return;
    }
    const valid = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(
      text,
    );
    const next = valid ? Number(text.replace(",", ".")) : NaN;
    if (!Number.isFinite(next) || next < min || next > max) {
      setError(
        `Bitte einen Wert zwischen ${formatted(min)} und ${formatted(max)} eingeben.`,
      );
      return;
    }
    closeExact(focus);
    if (next !== value) onCommit(next);
  };

  return (
    <div className="field range-field">
      <div className="range-heading">
        <label htmlFor={id}>{label}</label>
        {exact === null ? (
          <button
            ref={valueButton}
            className="range-value"
            type="button"
            aria-label={`${label} genau eingeben`}
            title="Genauen Wert eingeben"
            onClick={() => {
              editing.current = true;
              setError(null);
              setExact(String(value).replace(".", ","));
            }}
          >
            {formatted(displayed)}
          </button>
        ) : (
          <input
            ref={exactInput}
            className="range-exact"
            type="text"
            inputMode="decimal"
            aria-label={`${label} – genauer Wert`}
            aria-description={unit ? `Einheit: ${unit}` : undefined}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            value={exact}
            onChange={(event) => {
              setExact(event.target.value);
              setError(null);
            }}
            onBlur={() => commitExact(false)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== "Escape") return;
              event.preventDefault();
              event.stopPropagation();
              if (event.key === "Escape") closeExact(true);
              else commitExact(true);
            }}
          />
        )}
      </div>
      <input
        id={id}
        className="range-input"
        type="range"
        aria-label={label}
        min={isLog ? 0 : min}
        max={isLog ? 1000 : max}
        step={isLog ? 1 : step}
        value={position(displayed)}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={displayed}
        aria-valuetext={formatted(displayed)}
        style={
          {
            "--range-progress": `${Math.max(0, Math.min(100, progress))}%`,
          } as CSSProperties
        }
        onChange={(event) => {
          if (cancelledPointer.current) return;
          const next = fromPosition(event.target.valueAsNumber);
          pending.current = next;
          setDraft(next);
          // Assistive technologies can change a native slider without a pointer
          // or key gesture. Such discrete changes are complete immediately.
          if (live || (!pointer.current && !keyboard.current)) {
            pending.current = null;
            if (next !== value) onCommit(next);
            if (!pointer.current && !keyboard.current) setDraft(null);
          }
        }}
        onPointerDown={(event) => {
          if (exact !== null) closeExact(false);
          cancelledPointer.current = false;
          pointer.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={() => {
          cancelledPointer.current = false;
          commitRange();
        }}
        onPointerCancel={() => {
          cancelledPointer.current = false;
          clearDraft();
        }}
        onLostPointerCapture={() => {
          cancelledPointer.current = false;
          if (pointer.current) clearDraft();
        }}
        onKeyDown={(event) => {
          if (rangeKeys.has(event.key)) {
            if (exact !== null) closeExact(false);
            keyboard.current = true;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            cancelledPointer.current = pointer.current;
            clearDraft();
          }
        }}
        onKeyUp={(event) => {
          if (rangeKeys.has(event.key)) commitRange();
        }}
        onBlur={commitRange}
      />
      <div className="range-bounds" aria-hidden="true">
        <span>{formatted(min)}</span>
        <span>{formatted(max)}</span>
      </div>
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
