// Adapted radix-nova source; provenance and MIT notices: docs/ui-component-provenance.md.
import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

const buttonVariants = cva('ui-button inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent text-sm font-semibold', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground',
      outline: 'border-input bg-card text-card-foreground',
      secondary: 'bg-secondary text-secondary-foreground',
      ghost: 'bg-transparent text-foreground',
      destructive: 'bg-error-soft text-destructive',
      link: 'bg-transparent text-primary underline underline-offset-4'
    },
    size: { default: 'min-h-11 px-4 py-2', icon: 'size-11 p-0' }
  },
  defaultVariants: { variant: 'default', size: 'default' }
})

function Button({ className, variant = 'default', size = 'default', asChild = false, type = 'button', ...props }: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }): React.JSX.Element {
  const Comp = asChild ? Slot : 'button'
  return <Comp data-slot="button" data-variant={variant} data-size={size} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
export { Button, buttonVariants }
