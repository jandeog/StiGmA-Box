// components/HeaderNavIcons.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type IconItem = {
  href: string;
  label: string;
  staticSrc: string;
  hoverSrc: string;
};

export default function HeaderNavIcons({
  items,
  variant,
}: {
  items: IconItem[];
  variant: 'desktop' | 'mobile';
}) {
  const pathname = usePathname();
  const isDesktop = variant === 'desktop';

  const navClass = isDesktop
    ? 'hidden md:flex items-center gap-4'
    : 'md:hidden flex items-center justify-between gap-4 pb-3 mt-2';

  return (
    <nav className={navClass}>
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        const wrapperClasses = isDesktop
          ? 'group flex items-center justify-center w-24 h-24'
          : 'group flex items-center justify-center w-16 h-16';
        const iconSizeClasses = isDesktop ? 'w-24 h-24' : 'w-16 h-16';

        return (
          <Link key={item.href} href={item.href} className={wrapperClasses}>
            <span className={`relative inline-block ${iconSizeClasses}`}>
              {/* Static icon */}
              <img
                src={item.staticSrc}
                alt={item.label}
                className={`absolute inset-0 w-full h-full transition-opacity duration-150 ${
                  active
                    ? 'opacity-0'
                    : 'opacity-100 group-hover:opacity-0'
                }`}
              />
              {/* Hover / active icon */}
              <img
                src={item.hoverSrc}
                alt={item.label}
                className={`absolute inset-0 w-full h-full transition-opacity duration-150 ${
                  active
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100'
                }`}
              />
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
