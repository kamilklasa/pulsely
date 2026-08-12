import type { SVGProps } from "react";

import { cn } from "@/shared/lib/utils";

function GbFlagIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={cn("size-4 shrink-0", className)}
      {...props}
    >
      <defs>
        <clipPath id="gb-flag-circle">
          <circle cx="256" cy="256" r="256" />
        </clipPath>
      </defs>
      <g clipPath="url(#gb-flag-circle)">
        <rect width="512" height="512" fill="#012169" />
        <path d="M0 0 512 512M512 0 0 512" stroke="#FFF" strokeWidth="60" />
        <path d="M0 0 512 512M512 0 0 512" stroke="#C8102E" strokeWidth="24" />
        <path d="M256 0V512M0 256H512" stroke="#FFF" strokeWidth="100" />
        <path d="M256 0V512M0 256H512" stroke="#C8102E" strokeWidth="60" />
      </g>
    </svg>
  );
}

function PlFlagIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={cn("size-4 shrink-0", className)}
      {...props}
    >
      <defs>
        <clipPath id="pl-flag-circle">
          <circle cx="256" cy="256" r="256" />
        </clipPath>
      </defs>
      <g clipPath="url(#pl-flag-circle)">
        <rect width="512" height="256" fill="#FFF" />
        <rect y="256" width="512" height="256" fill="#DC143C" />
      </g>
    </svg>
  );
}

export { GbFlagIcon, PlFlagIcon };
