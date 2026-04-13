import { type InputHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:   string
  error?:   string
  helper?:  string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, className, ...props }, ref) => (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}
      <input
        ref={ref}
        {...props}
        className={clsx(
          'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm',
          'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400',
          error
            ? 'border-red-300 focus:border-red-300 focus:ring-red-300'
            : 'border-gray-300 focus:border-brand-400',
          className,
        )}
      />
      {error  && <p className="text-xs text-red-600">{error}</p>}
      {helper && !error && <p className="text-xs text-gray-500">{helper}</p>}
    </div>
  )
)
Input.displayName = 'Input'
