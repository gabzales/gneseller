import {
  LayoutGrid,
  KeyRound,
  History,
  Wallet,
  Receipt,
  CalendarDays,
  UserRound,
  ShieldCheck,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/dashboard/generate", label: "Generate Keys", icon: KeyRound, exact: false },
  { href: "/dashboard/history/keys", label: "History Key", icon: History, exact: false },
  { href: "/dashboard/topup", label: "Top Up", icon: Wallet, exact: false },
  { href: "/dashboard/history/topup", label: "History Top Up", icon: Receipt, exact: false },
  { href: "/dashboard/calendar", label: "Activity", icon: CalendarDays, exact: false },
  { href: "/dashboard/profile", label: "Profile", icon: UserRound, exact: false },
] as const;

// Only shown to role === 'admin' -- Sidebar appends this itself, see
// src/lib/require-admin.ts for the server-side gate that actually
// protects the routes underneath it.
export const ADMIN_NAV_ITEM = {
  href: "/dashboard/admin",
  label: "Admin",
  icon: ShieldCheck,
  exact: false,
} as const;

// Subset shown on the mobile bottom tab bar — matches the reference layout
// (Robot/Bot placeholder → Dashboard, Calendar, Profile). Admin tab is
// appended separately at render time (BottomNav) when role === 'admin',
// same pattern as Sidebar below.
export const MOBILE_TABS = [
  { href: "/dashboard", label: "Home", icon: LayoutGrid, exact: true },
  { href: "/dashboard/calendar", label: "Activity", icon: CalendarDays, exact: false },
  { href: "/dashboard/profile", label: "Profile", icon: UserRound, exact: false },
] as const;
