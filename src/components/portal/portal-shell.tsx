"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PortalSignOutButton } from "@/components/portal/portal-sign-out-button";
import type { PortalStorageSummary, PortalUser } from "@/lib/portal/data";

type PortalShellProps = {
  user: PortalUser;
  storageSummary: PortalStorageSummary;
  hasAdminSession: boolean;
  children: React.ReactNode;
};

const navItems = [
  { href: "/overview", label: "Overview", icon: "overview" },
  { href: "/files", label: "My Files", icon: "files" },
  { href: "/starred", label: "Starred", icon: "starred" },
  { href: "/trash", label: "Trash", icon: "trash" },
] as const;

const accountItems = [
  { href: "/settings", label: "Settings", icon: "settings" },
  { href: "/profile", label: "Profile", icon: "profile" },
  { href: "/security", label: "Security", icon: "security" },
] as const;

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    overview: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    files: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path d="M4 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    contacts: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path d="M16 11a4 4 0 1 0-8 0M4 20a8 8 0 0 1 16 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    starred: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path d="m12 3 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.8 7.2 17.9l.9-5.4L4.2 8.7l5.4-.8L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    trash: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path d="M4 7h16M9 7V5h6v2M10 11v6M14 11v6M6 7l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    settings: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
      </svg>
    ),
    profile: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <circle cx="12" cy="8" r="4" />
        <path d="M5 20c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5" strokeLinecap="round" />
      </svg>
    ),
    security: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path d="M12 3 20 7v6c0 5-3.5 7.5-8 8-4.5-.5-8-3-8-8V7l8-4Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };
  return <>{paths[name] ?? null}</>;
}

function PortalLogo({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/overview" onClick={onNavigate} className="portal-logo flex items-center gap-3 px-1">
      <span className="portal-logo-mark flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/20">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
          <path d="M6 14.5c0-3.3 2.7-6 6-6 1.6 0 3 .6 4.1 1.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M7 17.5h10a3 3 0 0 0 .8-5.9A5.5 5.5 0 0 0 7.2 9.5 4.5 4.5 0 0 0 7 17.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </span>
      <span>
        <span className="block text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          CloudStoreNow
        </span>
        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
          Secure cloud storage
        </span>
      </span>
    </Link>
  );
}

function StorageMini({ summary }: { summary: PortalStorageSummary }) {
  return (
    <div className="portal-storage-mini rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-indigo-50 p-4 dark:border-sky-900/40 dark:from-sky-950/40 dark:to-indigo-950/30">
      <p className="text-xs font-medium uppercase tracking-wide text-sky-700 dark:text-sky-300">
        Storage
      </p>
      <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {summary.usedLabel}
        <span className="font-normal text-zinc-500 dark:text-zinc-400">
          {" "}
          / {summary.quotaLabel}
        </span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70 dark:bg-zinc-900/70">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-500"
          style={{ width: `${summary.percentUsed}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        {summary.remainingLabel} remaining
      </p>
    </div>
  );
}

function SidebarNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`portal-nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-white text-sky-700 shadow-sm dark:bg-zinc-900 dark:text-sky-300"
                : "text-zinc-600 hover:bg-white/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-100"
            }`}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
      <div className="my-4 border-t border-zinc-200/80 dark:border-zinc-800" />
      {accountItems.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`portal-nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-white text-sky-700 shadow-sm dark:bg-zinc-900 dark:text-sky-300"
                : "text-zinc-600 hover:bg-white/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-100"
            }`}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ProfileMenu({
  user,
  hasAdminSession,
  open,
  onOpen,
  onClose,
}: {
  user: PortalUser;
  hasAdminSession: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = (user.name ?? user.email)
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("");

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, onClose]);

  return (
    <div ref={menuRef} className="portal-profile-menu relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="portal-profile-dropdown"
        onClick={() => (open ? onClose() : onOpen())}
        className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2 py-1.5 pl-1.5 shadow-sm transition hover:border-sky-200 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-sky-800"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-sm font-semibold text-white">
          {initials || "U"}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[10rem] truncate text-sm font-medium">
            {user.name ?? "Account"}
          </span>
          <span className="block max-w-[10rem] truncate text-xs text-zinc-500 dark:text-zinc-400">
            {user.email}
          </span>
        </span>
      </button>
      {open ? (
        <div
          id="portal-profile-dropdown"
          role="menu"
          className="portal-profile-dropdown absolute right-0 mt-2 max-h-[min(24rem,calc(100dvh-var(--portal-header-height)-1rem))] w-56 overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <p className="truncate text-sm font-medium">{user.name ?? "Account"}</p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
          </div>
          <div className="p-2">
            <Link href="/profile" role="menuitem" className="portal-menu-item" onClick={onClose}>
              Profile
            </Link>
            <Link href="/settings" role="menuitem" className="portal-menu-item" onClick={onClose}>
              Settings
            </Link>
            <Link href="/security" role="menuitem" className="portal-menu-item" onClick={onClose}>
              Security
            </Link>
            {hasAdminSession ? (
              <>
                <div className="my-2 border-t border-zinc-100 dark:border-zinc-800" />
                <Link
                  href="/admin"
                  role="menuitem"
                  className="portal-menu-item font-medium text-amber-700 dark:text-amber-300"
                  onClick={onClose}
                >
                  Admin Portal
                </Link>
              </>
            ) : null}
            <div className="my-2 border-t border-zinc-100 dark:border-zinc-800" />
            <PortalSignOutButton />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PortalShell({
  user,
  storageSummary,
  hasAdminSession,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const closeMobileDrawer = useCallback(() => {
    setMobileDrawerOpen(false);
  }, []);

  const closeProfileMenu = useCallback(() => {
    setProfileMenuOpen(false);
  }, []);

  const openMobileDrawer = useCallback(() => {
    setProfileMenuOpen(false);
    setMobileDrawerOpen(true);
  }, []);

  const openProfileMenu = useCallback(() => {
    setMobileDrawerOpen(false);
    setProfileMenuOpen(true);
  }, []);

  const toggleMobileDrawer = useCallback(() => {
    if (mobileDrawerOpen) {
      closeMobileDrawer();
      return;
    }
    openMobileDrawer();
  }, [mobileDrawerOpen, closeMobileDrawer, openMobileDrawer]);

  const handleMobileNavigate = useCallback(() => {
    closeMobileDrawer();
  }, [closeMobileDrawer]);

  useEffect(() => {
    // Close overlays when navigating (including browser back/forward).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route transitions must reset overlay state
    closeMobileDrawer();
    closeProfileMenu();
  }, [pathname, closeMobileDrawer, closeProfileMenu]);

  useEffect(() => {
    if (!mobileDrawerOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileDrawerOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (profileMenuOpen) {
        closeProfileMenu();
        return;
      }

      if (mobileDrawerOpen) {
        closeMobileDrawer();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileDrawerOpen, profileMenuOpen, closeMobileDrawer, closeProfileMenu]);

  return (
    <div className="portal-shell min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.08),_transparent_35%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="portal-sidebar hidden w-72 shrink-0 flex-col border-r border-white/60 bg-white/50 p-5 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/40 lg:flex">
          <PortalLogo />
          <div className="mt-8 flex-1 overflow-y-auto">
            <SidebarNav pathname={pathname} />
          </div>
          <div className="mt-6 space-y-4">
            <StorageMini summary={storageSummary} />
            <div className="rounded-2xl border border-zinc-200/80 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/70">
              <p className="truncate text-sm font-medium">{user.name ?? "Account"}</p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="portal-topbar sticky top-0 border-b border-white/70 bg-white/70 px-4 py-3 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/70 sm:px-6">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950 lg:hidden"
                aria-expanded={mobileDrawerOpen}
                aria-controls="portal-mobile-drawer"
                aria-label={mobileDrawerOpen ? "Close navigation menu" : "Open navigation menu"}
                onClick={toggleMobileDrawer}
              >
                {mobileDrawerOpen ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                    <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                    <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
                  </svg>
                )}
              </button>

              <div className="min-w-0 flex-1">
                <label className="relative block">
                  <span className="sr-only">Search files</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                  </svg>
                  <input
                    type="search"
                    placeholder="Search your files..."
                    className="w-full min-w-0 rounded-2xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none ring-sky-500/30 transition focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 sm:pr-4"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        const value = (event.target as HTMLInputElement).value.trim();
                        window.location.href = value
                          ? `/files?q=${encodeURIComponent(value)}`
                          : "/files";
                      }
                    }}
                  />
                </label>
              </div>

              <button
                type="button"
                aria-label="Notifications"
                className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:text-zinc-200 sm:flex"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path d="M15 17H9l-1 4h8l-1-4Z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <ProfileMenu
                user={user}
                hasAdminSession={hasAdminSession}
                open={profileMenuOpen}
                onOpen={openProfileMenu}
                onClose={closeProfileMenu}
              />
            </div>
          </header>

          {mobileDrawerOpen ? (
            <>
              <button
                type="button"
                className="portal-mobile-backdrop lg:hidden"
                aria-label="Close navigation menu"
                onClick={closeMobileDrawer}
              />
              <nav
                id="portal-mobile-drawer"
                aria-label="Main navigation"
                className="portal-mobile-drawer-panel lg:hidden"
              >
                <div className="portal-mobile-drawer-scroll">
                  <PortalLogo onNavigate={handleMobileNavigate} />
                  <div className="mt-4">
                    <SidebarNav pathname={pathname} onNavigate={handleMobileNavigate} />
                  </div>
                  <div className="mt-4">
                    <StorageMini summary={storageSummary} />
                  </div>
                </div>
              </nav>
            </>
          ) : null}

          <main className="portal-main-content flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>

      <nav
        aria-hidden={mobileDrawerOpen}
        className={`portal-mobile-nav fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/95 lg:hidden ${
          mobileDrawerOpen ? "pointer-events-none opacity-0" : ""
        }`}
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 py-2">
          {[...navItems, { href: "/profile", label: "Account", icon: "profile" as const }].map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                tabIndex={mobileDrawerOpen ? -1 : undefined}
                onClick={() => {
                  closeMobileDrawer();
                  closeProfileMenu();
                }}
                className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium ${
                  active
                    ? "text-sky-700 dark:text-sky-300"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
