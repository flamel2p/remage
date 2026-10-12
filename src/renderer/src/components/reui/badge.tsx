// Adapted REUI radix-nova source; provenance and MIT notices: docs/ui-component-provenance.md.
import type { ComponentProps } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex w-fit shrink-0 items-center rounded-full px-2 py-1 text-[0.8125rem] font-medium leading-[1.45]', {
  variants: { variant: {
    secondary: 'bg-secondary text-secondary-foreground',
    'primary-light': 'bg-accent text-accent-foreground',
    'success-light': 'bg-success-soft text-success',
    'warning-light': 'bg-warning-soft text-warning',
    'info-light': 'bg-info-soft text-info',
    'destructive-light': 'bg-error-soft text-destructive'
  } }, defaultVariants: { variant: 'secondary' }
})
type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }
function Badge({ className, variant, asChild = false, ...props }: BadgeProps): React.JSX.Element {
  const Comp = asChild ? Slot : 'span'
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}
export { Badge, badgeVariants, type BadgeProps }
