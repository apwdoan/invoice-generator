import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

interface FieldShell {
  label: string;
  hint?: ReactNode;
  hintTone?: "neutral" | "good" | "warn";
  className?: string;
}

function Hint({ id, hint, tone }: { id: string; hint?: ReactNode; tone?: FieldShell["hintTone"] }) {
  if (!hint) return null;
  return (
    <p id={id} className={`hint hint-${tone ?? "neutral"}`}>
      {hint}
    </p>
  );
}

type TextFieldProps = FieldShell &
  Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
    value: string;
    onChange: (value: string) => void;
  };

export function TextField({ label, hint, hintTone, className, value, onChange, id: givenId, ...rest }: TextFieldProps) {
  const generatedId = useId();
  const id = givenId ?? generatedId;
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...rest}
      />
      <Hint id={`${id}-hint`} hint={hint} tone={hintTone} />
    </div>
  );
}

type TextAreaProps = FieldShell &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
    value: string;
    onChange: (value: string) => void;
  };

export function TextArea({ label, hint, hintTone, className, value, onChange, rows = 3, ...rest }: TextAreaProps) {
  const id = useId();
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...rest}
      />
      <Hint id={`${id}-hint`} hint={hint} tone={hintTone} />
    </div>
  );
}

type SelectFieldProps = FieldShell &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & {
    value: string;
    onChange: (value: string) => void;
    children: ReactNode;
  };

export function SelectField({ label, hint, hintTone, className, value, onChange, children, ...rest }: SelectFieldProps) {
  const id = useId();
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
        {children}
      </select>
      <Hint id={`${id}-hint`} hint={hint} tone={hintTone} />
    </div>
  );
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  className,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <label className={`checkbox ${className ?? ""}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button type="button" className="icon-button" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export const RemoveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3.5 3.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const UpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3.5 8.5L7 5l3.5 3.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const DownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3.5 5.5L7 9l3.5-3.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
