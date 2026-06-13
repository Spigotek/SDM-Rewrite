import { forwardRef, useState } from "react";
import type { HTMLAttributes } from "react";
import { User } from "lucide-react";
import { cn } from "../../utils/cn";
import styles from "./Avatar.module.css";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AvatarStatus = "online" | "away" | "offline";

export interface AvatarProps extends Omit<HTMLAttributes<HTMLSpanElement>, "aria-label"> {
  /** Display name — drives initials, deterministic colour, and default `alt`/`aria-label`. */
  name: string;
  /** Optional image URL. When it loads successfully, the image wins over initials. */
  src?: string;
  /** Visual size. Defaults to `md` (32 px). `xl` (64 px) is profile-only. */
  size?: AvatarSize;
  /** Presence status. Renders a small dot in the bottom-right and announces via SR-only text. */
  status?: AvatarStatus;
  /** Overrides the accessible name. When omitted, `name` is used. */
  "aria-label"?: string;
}

const STATUS_DOT_CLASS = {
  online: styles.statusOnline as string,
  away: styles.statusAway as string,
  offline: styles.statusOffline as string,
} satisfies Record<AvatarStatus, string>;

const STATUS_LABEL = {
  online: "online",
  away: "away",
  offline: "offline",
} satisfies Record<AvatarStatus, string>;

const COLOR_CLASSES: readonly string[] = [
  styles.color0,
  styles.color1,
  styles.color2,
  styles.color3,
  styles.color4,
] as string[];

/**
 * Compute initials from a display name.
 *
 * - Multi-word: first character of first word + first character of last word.
 * - Single word: first two characters.
 * - Empty / whitespace-only: empty string (caller falls back to the User icon).
 */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  if (parts.length === 1) {
    return first.slice(0, 2).toUpperCase();
  }
  const last = parts[parts.length - 1] ?? "";
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

/**
 * Deterministic colour bucket from a display name — sum of charCodes mod 5.
 * Returns the index into the 5 colour classes (primary/success/info/warning/danger).
 */
export function hashNameToColorIndex(name: string): number {
  const key = name.trim().toLowerCase();
  if (key.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < key.length; i += 1) {
    sum += key.charCodeAt(i);
  }
  return sum % COLOR_CLASSES.length;
}

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(props, ref) {
  const { name, src, size = "md", status, "aria-label": ariaLabel, className, ...rest } = props;

  const [imageFailed, setImageFailed] = useState(false);

  const trimmedName = name.trim();
  const accessibleName = ariaLabel ?? trimmedName;
  const initials = getInitials(trimmedName);
  const hasImage = Boolean(src) && !imageFailed;
  const hasInitials = !hasImage && initials.length > 0;
  const colorIndex = hashNameToColorIndex(trimmedName);
  const colorClass = COLOR_CLASSES[colorIndex];

  const surfaceClass = hasImage
    ? cn(styles.surface, styles.imageSurface)
    : hasInitials
      ? cn(styles.surface, styles.initials, colorClass)
      : cn(styles.surface, styles.initials);

  return (
    <span
      ref={ref}
      className={cn(styles.avatar, styles[size], className)}
      data-component="avatar"
      data-size={size}
      data-status={status}
      role="img"
      aria-label={accessibleName || undefined}
      {...rest}
    >
      <span className={surfaceClass} aria-hidden="true">
        {hasImage ? (
          <img
            className={styles.image}
            src={src}
            alt=""
            onError={() => setImageFailed(true)}
            draggable={false}
          />
        ) : hasInitials ? (
          <span data-component="avatar-initials">{initials}</span>
        ) : (
          <User className={styles.iconFallback} aria-hidden="true" focusable="false" />
        )}
      </span>
      {status && (
        <>
          <span
            className={cn(styles.statusDot, STATUS_DOT_CLASS[status])}
            data-component="avatar-status-dot"
            aria-hidden="true"
          />
          <span className={styles.srOnly}>{`(${STATUS_LABEL[status]})`}</span>
        </>
      )}
    </span>
  );
});
