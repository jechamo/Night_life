import { cva, type VariantProps } from 'class-variance-authority'
import { motion, type HTMLMotionProps } from 'motion/react'
import type { ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from '@/shared/lib/cn'
import { PRESS_SCALE } from '@/shared/motion/presets'

export const buttonVariants = cva(
  [
    'touch-target inline-flex select-none items-center justify-center gap-2 rounded-full font-medium',
    'transition-opacity disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:size-5 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-[0_0_24px_var(--nl-glow)]',
        secondary: 'bg-secondary text-secondary-foreground',
        glass: 'glass text-foreground',
        outline: 'border border-border bg-transparent text-foreground',
        ghost: 'bg-transparent text-foreground',
        danger: 'bg-danger text-danger-foreground',
      },
      size: {
        sm: 'h-11 px-4 text-sm',
        md: 'h-12 px-5 text-base',
        lg: 'h-14 px-7 text-lg',
        icon: 'size-11 p-0',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
)

type ButtonVariantProps = VariantProps<typeof buttonVariants>

export interface ButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children'>, ButtonVariantProps {
  children?: ReactNode
}

/** Pressable button with spring press feedback (PRD 8.4 microinteractions). */
export function Button({
  className,
  variant,
  size,
  block,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      whileTap={{ scale: PRESS_SCALE }}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  )
}

export interface ButtonLinkProps extends LinkProps, ButtonVariantProps {}

/** Router link styled as a button (navigation stays a real link for a11y). */
export function ButtonLink({ className, variant, size, block, ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonVariants({ variant, size, block }), className)} {...props} />
}
