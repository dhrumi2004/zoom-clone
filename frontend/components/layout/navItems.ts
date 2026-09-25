import {
  CalendarDays,
  Contact,
  FileText,
  Home,
  LayoutGrid,
  LucideIcon,
  Mail,
  MessageCircle,
  PenLine,
  Video,
} from "lucide-react";
import type { Badges } from "@/lib/workspaceTypes";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  /** Shown in the "More" menu when the screen is too narrow for every tab */
  secondary?: boolean;
  badge?: keyof Badges;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", icon: Home, href: "/" },
  { label: "Team Chat", icon: MessageCircle, href: "/chat", badge: "chat_unread" },
  { label: "Meetings", icon: Video, href: "/meetings" },
  { label: "Mail", icon: Mail, href: "/mail", secondary: true, badge: "mail_unread" },
  { label: "Calendar", icon: CalendarDays, href: "/calendar", secondary: true },
  { label: "Docs", icon: FileText, href: "/docs", secondary: true },
  { label: "Whiteboards", icon: PenLine, href: "/whiteboards", secondary: true },
  { label: "Contacts", icon: Contact, href: "/contacts" },
  { label: "Apps", icon: LayoutGrid, href: "/apps", secondary: true },
];

export function isActive(item: NavItem, pathname: string) {
  return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
}
