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

export interface NavItem {
  label: string;
  icon: LucideIcon;
  /** Only Home and Meetings are real pages; the rest are placeholders for visual parity with Zoom. */
  href?: string;
  /** Hidden on narrower screens to keep the bar on one line */
  secondary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", icon: Home, href: "/" },
  { label: "Team Chat", icon: MessageCircle },
  { label: "Meetings", icon: Video, href: "/meetings" },
  { label: "Mail", icon: Mail, secondary: true },
  { label: "Calendar", icon: CalendarDays, secondary: true },
  { label: "Docs", icon: FileText, secondary: true },
  { label: "Whiteboards", icon: PenLine, secondary: true },
  { label: "Contacts", icon: Contact },
  { label: "Apps", icon: LayoutGrid, secondary: true },
];
