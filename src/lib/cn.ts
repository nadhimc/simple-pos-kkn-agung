import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Gabungkan class Tailwind dengan konflik utility yang terselesaikan. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
