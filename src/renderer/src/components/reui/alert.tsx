// Adapted REUI radix-nova source; provenance and MIT notices: docs/ui-component-provenance.md.
import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva('ui-alert rounded-lg border p-4 text-sm', { variants: { variant: {
  default: 'border-border bg-card text-card-foreground',
  destructive: 'border-destructive bg-error-soft text-destructive',
  info: 'border-info bg-info-soft text-info',
  success: 'border-success bg-success-soft text-success',
  warning: 'border-warning bg-warning-soft text-warning'
} }, defaultVariants: { variant: 'default' } })
function Alert({ className, variant, role = variant === 'destructive' ? 'alert' : undefined, ...props }: ComponentProps<'div'> & VariantProps<typeof alertVariants>): React.JSX.Element {
  return <div data-slot="alert" role={role} className={cn(alertVariants({ variant }), className)} {...props} />
}
function AlertTitle({ className, ...props }: ComponentProps<'div'>): React.JSX.Element { return <div data-slot="alert-title" className={cn('font-semibold', className)} {...props} /> }
function AlertDescription({ className, ...props }: ComponentProps<'div'>): React.JSX.Element { return <div data-slot="alert-description" className={cn('mt-1 leading-relaxed', className)} {...props} /> }
export { Alert, AlertTitle, AlertDescription }
