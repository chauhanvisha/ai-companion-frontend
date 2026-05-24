import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: Props) {
  return (
    <input
      className={twMerge(clsx(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2',
        'text-sm placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      ))}
      {...props}
    />
  )
}
