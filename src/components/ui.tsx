import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function PageHeader({ title, line, right }: { title: string; line?: string; right?: ReactNode }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-[30px] leading-tight font-bold">{title}</h1>
        {line ? <p className="mt-1 text-[16px] text-muted">{line}</p> : null}
      </div>
      {right}
    </header>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[14px] font-medium text-muted">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, now = false, className = '' }: { children: ReactNode; now?: boolean; className?: string }) {
  return <div className={`rounded-card bg-card ${now ? 'border-2 border-accent' : 'border border-line'} ${className}`}>{children}</div>;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'main' | 'plain' | 'chosen'; small?: boolean };

export function Button({ kind = 'plain', small = false, className = '', ...rest }: ButtonProps) {
  const look = kind === 'main' ? 'bg-ink text-on-ink' : kind === 'chosen' ? 'bg-accent text-on-ink' : 'border border-line bg-card text-ink';
  return <button type="button" className={`rounded-button px-4 font-semibold ${small ? 'min-h-11' : 'min-h-12'} disabled:opacity-50 ${look} ${className}`} {...rest} />;
}

export function Toggle({ label, detail, on, onChange }: { label: string; detail?: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 px-4 py-3">
      <span>
        <span className="block text-[16px] font-semibold">{label}</span>
        {detail ? <span className="block text-[14px] text-muted">{detail}</span> : null}
      </span>
      <input type="checkbox" className="size-6 accent-[var(--accent)]" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** A big on/off switch, the main control on every tile and room. */
export function Switch({ on, label, onChange, disabled = false }: { on: boolean; label: string; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-9 w-16 shrink-0 rounded-full border transition-colors disabled:opacity-40 ${on ? 'border-accent bg-accent' : 'border-line bg-paper'}`}
    >
      <span className={`absolute top-1 size-7 rounded-full bg-card shadow transition-transform ${on ? 'translate-x-8' : 'translate-x-1'}`} />
    </button>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-[820px] px-5 pt-4 pb-8 md:px-8">{children}</main>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[14px] font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputClass = 'w-full min-h-12 rounded-button border border-line bg-card px-3 text-[16px]';

export function Notice({ children }: { children: ReactNode }) {
  return <p className="mb-4 rounded-card bg-notice px-4 py-3 text-[15px]">{children}</p>;
}
