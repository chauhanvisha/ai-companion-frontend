import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

type Variant = 'default' | 'outline' | 'ghost' | 'secondary'
type Size = 'default' | 'sm' | 'lg'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  ghost:   'hover:bg-accent hover:text-accent-foreground',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
}

const sizes: Record<Size, string> = {
  default: 'h-10 px-4 py-2 text-sm',
  sm:      'h-9 px-3 text-sm',
  lg:      'h-11 px-8 text-base',
}

export function Button({ variant = 'default', size = 'default', className, ...props }: Props) {
  return (
    <button
      className={twMerge(clsx(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      ))}
      {...props}
    />
  )
}
