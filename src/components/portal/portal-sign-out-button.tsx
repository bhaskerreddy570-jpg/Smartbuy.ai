"use client";

import { signOut } from "next-auth/react";

export function PortalSignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="portal-menu-item w-full text-left text-red-600 dark:text-red-400"
    >
      Sign out
    </button>
  );
}
