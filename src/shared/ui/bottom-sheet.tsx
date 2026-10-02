import { X } from 'lucide-react'
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react'
import { Dialog } from 'radix-ui'
import type { ReactNode } from 'react'
import { useMotionTokens } from '@/shared/motion/MotionPreferencesProvider'
import { Button } from './button'

const DISMISS_OFFSET_PX = 120
const DISMISS_VELOCITY = 600

export interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  closeLabel: string
  dragHint: string
  children?: ReactNode
}

/**
 * Bottom sheet with spring physics (PRD 5.3 "ficha", 8.4). Radix Dialog gives focus
 * trap, Escape and aria; Motion gives the spring. Dragging down past a threshold or
 * with enough velocity closes it, and the close button is always there (PRD 3.3:
 * every gesture has a button alternative).
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  dragHint,
  children,
}: BottomSheetProps) {
  const tokens = useMotionTokens()
  const dragControls = useDragControls()

  const handleDragEnd = (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    if (info.offset.y > DISMISS_OFFSET_PX || info.velocity.y > DISMISS_VELOCITY) onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-black/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={tokens.fade}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              {...(description ? {} : { 'aria-describedby': undefined })}
            >
              <motion.div
                className="glass-strong fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] max-w-lg flex-col rounded-t-[1.75rem] pb-safe text-foreground shadow-[0_-12px_48px_rgb(0_0_0/0.5)] outline-none"
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={tokens.spring.sheet}
                drag="y"
                dragControls={dragControls}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.04, bottom: 0.7 }}
                onDragEnd={handleDragEnd}
              >
                <div
                  className="flex h-8 shrink-0 cursor-grab touch-none items-center justify-center"
                  onPointerDown={(event) => dragControls.start(event)}
                  title={dragHint}
                  aria-hidden
                >
                  <span className="h-1.5 w-12 rounded-full bg-muted-foreground/60" />
                </div>
                <div className="flex items-start justify-between gap-3 px-5">
                  <div>
                    <Dialog.Title className="font-display text-2xl font-semibold">
                      {title}
                    </Dialog.Title>
                    {description && (
                      <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                        {description}
                      </Dialog.Description>
                    )}
                  </div>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="icon" aria-label={closeLabel}>
                      <X aria-hidden />
                    </Button>
                  </Dialog.Close>
                </div>
                <div className="overflow-y-auto px-5 pt-3 pb-5">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
