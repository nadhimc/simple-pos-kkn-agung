import { useId } from 'react'
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/cn'

/*
  Aturan form yang berlaku di seluruh aplikasi:
  label SELALU di atas input, helper opsional, pesan error di bawah input.
  Placeholder tidak pernah dipakai sebagai pengganti label.
*/

const controlBase =
  'w-full rounded-control border bg-surface px-3 text-sm text-ink transition-colors ' +
  'placeholder:text-ink-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ' +
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-subtle'

interface FieldShellProps {
  id: string
  label: string
  helper?: string
  error?: string
  required?: boolean
  className?: string
  children: ReactNode
}

function FieldShell({
  id,
  label,
  helper,
  error,
  required,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>
      {children}
      {helper && !error ? (
        <p id={`${id}-helper`} className="text-xs text-ink-muted">
          {helper}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  helper?: string
  error?: string
  /** Ditempel di kiri input, misalnya "Rp". */
  prefix?: string
  containerClassName?: string
}

export function TextField({
  label,
  helper,
  error,
  prefix,
  required,
  className,
  containerClassName,
  ...props
}: TextFieldProps) {
  const id = useId()
  return (
    <FieldShell
      id={id}
      label={label}
      helper={helper}
      error={error}
      required={required}
      className={containerClassName}
    >
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-subtle">
            {prefix}
          </span>
        ) : null}
        <input
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : helper ? `${id}-helper` : undefined}
          className={cn(
            controlBase,
            'h-11',
            error ? 'border-danger' : 'border-border-strong',
            prefix && 'pl-10',
            className,
          )}
          {...props}
        />
      </div>
    </FieldShell>
  )
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string
  helper?: string
  error?: string
  options: { value: string; label: string }[]
  containerClassName?: string
}

export function SelectField({
  label,
  helper,
  error,
  options,
  required,
  className,
  containerClassName,
  ...props
}: SelectFieldProps) {
  const id = useId()
  return (
    <FieldShell
      id={id}
      label={label}
      helper={helper}
      error={error}
      required={required}
      className={containerClassName}
    >
      <select
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(
          controlBase,
          'h-11 appearance-none pr-9',
          // Panah dibuat dari gradient CSS, bukan SVG ikon buatan tangan.
          'bg-[linear-gradient(45deg,transparent_50%,currentColor_50%),linear-gradient(135deg,currentColor_50%,transparent_50%)]',
          'bg-[length:5px_5px,5px_5px] bg-[position:calc(100%-18px)_50%,calc(100%-13px)_50%] bg-no-repeat',
          error ? 'border-danger' : 'border-border-strong',
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

interface TextAreaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string
  helper?: string
  error?: string
  containerClassName?: string
}

export function TextAreaField({
  label,
  helper,
  error,
  required,
  className,
  containerClassName,
  ...props
}: TextAreaFieldProps) {
  const id = useId()
  return (
    <FieldShell
      id={id}
      label={label}
      helper={helper}
      error={error}
      required={required}
      className={containerClassName}
    >
      <textarea
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(
          controlBase,
          'min-h-20 resize-y py-2.5',
          error ? 'border-danger' : 'border-border-strong',
          className,
        )}
        {...props}
      />
    </FieldShell>
  )
}
