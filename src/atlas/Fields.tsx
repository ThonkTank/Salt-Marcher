import { useEffect, useId, useRef, useState } from "react";
import type { InputHTMLAttributes } from "react";

type FieldProps = {
  label: string;
  value: string;
  validate: (text: string) => string | null;
  commit: (text: string) => string | void;
} & Pick<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "min" | "max" | "step"
>;

/** Field edits own Enter/Escape and stay editable after validation failures. */
function Field({ label, value, validate, commit, ...input }: FieldProps) {
  const [text, setText] = useState(value);
  const focused = useRef(false);
  const cancelled = useRef(false);
  const errorId = useId();
  const error = validate(text);
  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);
  return (
    <label>
      {label}
      <input
        {...input}
        aria-label={label}
        value={text}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== "Escape") return;
          e.preventDefault();
          e.stopPropagation();
          cancelled.current = e.key === "Escape";
          e.currentTarget.blur();
        }}
        onBlur={() => {
          focused.current = false;
          if (cancelled.current) {
            cancelled.current = false;
            setText(value);
          } else if (!error) {
            const normalized = commit(text);
            if (normalized !== undefined) setText(normalized);
          }
        }}
      />
      {error && (
        <span id={errorId} className="text-danger" role="status">
          {error}
        </span>
      )}
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <Field
      label={label}
      value={String(value)}
      type="number"
      min={min}
      max={max}
      step={step}
      validate={(text) => {
        const number = Number(text);
        return text === "" || !Number.isFinite(number)
          ? "Bitte eine Zahl eingeben."
          : min !== undefined && number < min
            ? `Mindestens ${min}.`
            : max !== undefined && number > max
              ? `Höchstens ${max}.`
              : null;
      }}
      commit={(text) => {
        const number = Number(text);
        if (number !== value) onChange(number);
        else return String(value);
      }}
    />
  );
}

export function Rename({
  name,
  label,
  onChange,
}: {
  name: string;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field
      label={label}
      value={name}
      // Rust str::trim uses Unicode White_Space; JavaScript trim differs for NEL/FEFF.
      validate={(text) =>
        /^\p{White_Space}*$/u.test(text)
          ? "Der Name darf nicht leer sein oder nur Leerraum enthalten."
          : Array.from(text).length > 120
            ? "Der Name darf höchstens 120 Unicodezeichen enthalten."
            : null
      }
      commit={(text) => {
        if (text !== name) onChange(text);
      }}
    />
  );
}
