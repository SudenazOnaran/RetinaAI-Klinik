import { cn } from '@/lib/utils';
import type { SVGProps } from 'react';

export function RetinaAiLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-6 w-6', props.className)}
      {...props}
    >
      <title>Retina AI Logo</title>
      {/* Outer circle */}
      <circle cx="12" cy="12" r="10" opacity="0.3" strokeWidth="2" />
      
      {/* Eye */}
      <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" />
      <path d="M12 12.5C12.2761 12.5 12.5 12.2761 12.5 12C12.5 11.7239 12.2761 11.5 12 11.5C11.7239 11.5 11.5 11.7239 11.5 12C11.5 12.2761 11.7239 12.5 12 12.5Z" />

      {/* Focus Brackets */}
      <path d="M7 7L5 7L5 9" />
      <path d="M17 7L19 7L19 9" />
      <path d="M7 17L5 17L5 15" />
      <path d="M17 17L19 17L19 15" />
    </svg>
  );
}
