"use client";

import React from "react";
import Link from "next/link";

export function AyubLogo({
  clubName = "AYUB CLUB PRO",
  storeName = "AYUB PARFUM",
  compact = false,
  secretIconHref,
}: {
  clubName?: string;
  storeName?: string;
  compact?: boolean;
  secretIconHref?: string;
}) {
  const iconBox = (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#064E3B] via-[#047857] to-[#022c22] shadow-md ring-1 ring-[#D4AF37]/60">
      <svg
        viewBox="0 0 40 40"
        className="h-7 w-7 text-[#D4AF37]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Perfume flacon crown + diamond crest */}
        <rect
          x="15"
          y="5"
          width="10"
          height="4"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M17 9H23V13L29 18.5V31C29 32.6569 27.6569 34 26 34H14C12.3431 34 11 32.6569 11 31V18.5L17 13V9Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M20 18L23.5 23.5L20 29L16.5 23.5L20 18Z"
          fill="currentColor"
          fillOpacity="0.25"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    </div>
  );

  return (
    <div className="flex items-center gap-3 select-none">
      {secretIconHref ? (
        <Link href={secretIconHref} aria-label={storeName} className="shrink-0">
          {iconBox}
        </Link>
      ) : (
        iconBox
      )}
      {!compact && (
        <div className="leading-tight">
          <div className="font-serif-luxury text-base font-bold tracking-wider text-[#064E3B] dark:text-[#D4AF37]">
            {clubName}
          </div>
          <div className="text-[11px] font-semibold tracking-[0.22em] uppercase text-neutral-500 dark:text-neutral-400">
            {storeName}
          </div>
        </div>
      )}
    </div>
  );
}
