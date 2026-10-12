import * as Primitive from '@radix-ui/react-alert-dialog'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const AlertDialog = Primitive.Root
const AlertDialogTrigger = Primitive.Trigger
const AlertDialogCancel = Primitive.Cancel
const AlertDialogAction = Primitive.Action
const AlertDialogTitle = Primitive.Title
const AlertDialogDescription = Primitive.Description
function AlertDialogContent({ className, children, ...props }: ComponentProps<typeof Primitive.Content>): React.JSX.Element {
  return <Primitive.Portal><Primitive.Overlay className="dialog-overlay" /><Primitive.Content className={cn('dialog-content confirm-dialog', className)} {...props}>{children}</Primitive.Content></Primitive.Portal>
}
export { AlertDialog, AlertDialogTrigger, AlertDialogCancel, AlertDialogAction, AlertDialogTitle, AlertDialogDescription, AlertDialogContent }
