import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface WhatsAppAvatarProps {
  name?: string | null;
  phone: string;
  pictureUrl?: string | null;
  className?: string;
}

function getInitials(name: string | null | undefined, phone: string) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  }
  return phone.slice(-2);
}

/**
 * Avatar that displays the contact's WhatsApp profile picture
 * with graceful fallback to initials when unavailable.
 */
export function WhatsAppAvatar({ name, phone, pictureUrl, className }: WhatsAppAvatarProps) {
  return (
    <Avatar className={cn("h-10 w-10 shrink-0", className)}>
      {pictureUrl && <AvatarImage src={pictureUrl} alt={name || phone} />}
      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
        {getInitials(name, phone)}
      </AvatarFallback>
    </Avatar>
  );
}
