import { ReactNode, useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * ONE FORM FIELD: label above, the control, then a hint or an error under it.
 *
 * Replaces the ~16 local `Field` copies (10px uppercase grey labels with no
 * link to their input). Here the label is readable (`text-sm font-medium`,
 * sentence case) and is tied to the control, so a click on the words puts the
 * caret in the box and a screen reader announces them.
 *
 * Two ways to connect the control:
 *
 *   <FormField label="Phone">
 *     {(f) => <Input {...f} value={phone} onChange={…} />}
 *   </FormField>
 *
 * The render form hands over `id`, `aria-describedby` and `aria-invalid`. For a
 * control that cannot take an id (a custom picker), pass plain children and,
 * if it has one, its id as `htmlFor`.
 *
 * Keep the label text in its own node (no values interpolated into it) so the
 * Bangla layer can translate it.
 */

export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  'aria-required'?: true;
}

interface Props {
  label: ReactNode;
  children: ReactNode | ((field: FieldControlProps) => ReactNode);
  /** Id of the control when `children` is not the render form. */
  htmlFor?: string;
  required?: boolean;
  /** Help under the field. Hidden while an error is showing. */
  hint?: ReactNode;
  /** Error under the field, in red. Also marks the control invalid. */
  error?: ReactNode;
  /** Small action at the right end of the label row, e.g. "+ New". */
  action?: ReactNode;
  className?: string;
}

export function FormField({
  label,
  children,
  htmlFor,
  required,
  hint,
  error,
  action,
  className,
}: Props) {
  const autoId = useId();
  const id = htmlFor ?? `f${autoId}`;
  const msgId = `${id}-msg`;
  const hasMsg = Boolean(error || hint);

  const control =
    typeof children === 'function'
      ? children({
          id,
          'aria-describedby': hasMsg ? msgId : undefined,
          'aria-invalid': error ? true : undefined,
          'aria-required': required ? true : undefined,
        })
      : children;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-end justify-between gap-2 min-h-5">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
          {required && (
            <span className="text-destructive ml-0.5" aria-hidden>
              *
            </span>
          )}
        </label>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {control}
      {error ? (
        <p id={msgId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
