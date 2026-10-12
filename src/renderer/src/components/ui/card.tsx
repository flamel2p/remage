// Adapted radix-nova source; provenance and MIT notices: docs/ui-component-provenance.md.
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

function Card({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return <div data-slot="card" className={cn('ui-card flex flex-col gap-6 rounded-xl bg-card text-card-foreground', className)} {...props} />
}
function CardHeader({ className, ...props }: ComponentProps<'div'>): React.JSX.Element { return <div data-slot="card-header" className={cn('grid gap-1', className)} {...props} /> }
function CardContent({ className, ...props }: ComponentProps<'div'>): React.JSX.Element { return <div data-slot="card-content" className={className} {...props} /> }
function CardTitle({ className, ...props }: ComponentProps<'h2'>): React.JSX.Element { return <h2 data-slot="card-title" className={className} {...props} /> }
function CardDescription({ className, ...props }: ComponentProps<'p'>): React.JSX.Element { return <p data-slot="card-description" className={cn('text-sm text-muted-foreground', className)} {...props} /> }
export { Card, CardHeader, CardContent, CardTitle, CardDescription }
