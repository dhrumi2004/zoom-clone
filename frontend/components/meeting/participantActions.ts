/**
 * The actions Zoom offers for a person (on their video tile's "…" menu and in the Participants panel).
 * One builder so both places always offer the same options with the same permission rules.
 */
import { Crown, Hand, MicOff, Mic, Pencil, Pin, PinOff, Star, StarOff, UserMinus, Video, VideoOff } from "lucide-react";
import type { MenuItem } from "@/components/ui/DropdownMenu";
import type { MeetingClient } from "@/lib/meeting/client";
import type { TileInfo } from "./VideoTile";

export interface ActionContext {
  client: MeetingClient;
  isHost: boolean;
  isModerator: boolean;
  allowRename: boolean;
  spotlightId: number | null;
  pinnedId: number | null;
  setPinned: (id: number | null) => void;
  onRename: (person: TileInfo) => void;
  onRemove: (person: TileInfo) => void;
}

export function participantActions(p: TileInfo, ctx: ActionContext): MenuItem[] {
  const items: MenuItem[] = [];
  const manage = ctx.isModerator && !p.isSelf && (!p.isHost || ctx.isHost);

  items.push(
    ctx.pinnedId === p.id
      ? { label: "Unpin", icon: PinOff, onSelect: () => ctx.setPinned(null) }
      : { label: "Pin", icon: Pin, onSelect: () => ctx.setPinned(p.id) },
  );
  if (ctx.isModerator) {
    items.push(
      ctx.spotlightId === p.id
        ? { label: "Remove spotlight", icon: StarOff, onSelect: () => ctx.client.spotlight(null) }
        : { label: "Spotlight for everyone", icon: Star, onSelect: () => ctx.client.spotlight(p.id) },
    );
  }
  if (manage) {
    items.push(
      p.micMuted
        ? { label: "Ask to unmute", icon: Mic, onSelect: () => ctx.client.askToUnmute(p.id) }
        : { label: "Mute", icon: MicOff, onSelect: () => ctx.client.muteParticipant(p.id) },
      p.videoOn
        ? { label: "Stop video", icon: VideoOff, onSelect: () => ctx.client.stopVideo(p.id) }
        : { label: "Ask to start video", icon: Video, onSelect: () => ctx.client.askToStartVideo(p.id) },
    );
    if (p.handRaised) items.push({ label: "Lower hand", icon: Hand, onSelect: () => ctx.client.lowerHand(p.id) });
  }
  if ((p.isSelf && (ctx.allowRename || ctx.isModerator)) || manage) {
    items.push({ label: "Rename", icon: Pencil, onSelect: () => ctx.onRename(p) });
  }
  if (ctx.isHost && !p.isSelf && !p.isHost) {
    items.push(
      p.isCohost
        ? { label: "Withdraw co-host permission", icon: Crown, onSelect: () => ctx.client.setCohost(p.id, false) }
        : { label: "Make co-host", icon: Crown, onSelect: () => ctx.client.setCohost(p.id, true) },
    );
  }
  if (manage && !p.isHost) items.push({ label: "Remove", icon: UserMinus, danger: true, onSelect: () => ctx.onRemove(p) });
  return items;
}
