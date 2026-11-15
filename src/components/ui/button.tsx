import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
const buttonVariants = cva('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500 disabled:pointer-events-none disabled:opacity-40', { variants: { variant: { default: 'bg-[#b93232] text-white hover:bg-[#d23c3c]', outline: 'border border-[#3b3c43] bg-[#1b1c20] text-[#e5e5eb] hover:bg-[#292a30]', ghost: 'text-[#b8b9c3] hover:bg-[#292a30]' }, size: { default: 'h-12 px-5', sm: 'h-10 px-4' } }, defaultVariants: { variant: 'default', size: 'default' } })
export function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & {asChild?: boolean}) { const Comp = asChild ? Slot : 'button'; return <Comp className={twMerge(clsx(buttonVariants({variant,size}),className))} {...props}/> }
