import * as Primitive from '@radix-ui/react-dialog'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const Dialog = Primitive.Root
const DialogTrigger = Primitive.Trigger
const DialogClose = Primitive.Close
const DialogTitle = Primitive.Title
const DialogDescription = Primitive.Description
function DialogContent({ className, children, ...props }: ComponentProps<typeof Primitive.Content>): React.JSX.Element {
  return <Primitive.Portal><Primitive.Overlay className="dialog-overlay" /><Primitive.Content className={cn('dialog-content', className)} {...props}>{children}</Primitive.Content></Primitive.Portal>
}
export { Dialog, DialogTrigger, DialogClose, DialogTitle, DialogDescription, DialogContent }
