import { Children, cloneElement, forwardRef, isValidElement } from "react";
import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import { cn } from "../../utils/cn";
import type { AvatarProps, AvatarSize } from "./Avatar";
import { Avatar } from "./Avatar";
import styles from "./Avatar.module.css";

export interface AvatarGroupProps extends HTMLAttributes<HTMLSpanElement> {
  /** Avatar elements to stack. Order = visual stacking order (first on top). */
  children: ReactNode;
  /** Maximum visible avatars before collapsing into a `+N` chip. Defaults to 3. */
  max?: number;
  /** Uniform size applied to all children + the overflow chip. Defaults to `md`. */
  size?: AvatarSize;
}

const isAvatarElement = (node: ReactNode): node is ReactElement<AvatarProps> => {
  return isValidElement(node) && node.type === Avatar;
};

export const AvatarGroup = forwardRef<HTMLSpanElement, AvatarGroupProps>(
  function AvatarGroup(props, ref) {
    const { children, max = 3, size = "md", className, ...rest } = props;

    const avatars = Children.toArray(children).filter(isAvatarElement);
    const visible = avatars.slice(0, max);
    const overflow = avatars.length - visible.length;

    return (
      <span
        ref={ref}
        className={cn(styles.group, className)}
        data-component="avatar-group"
        data-size={size}
        {...rest}
      >
        {visible.map((child, index) => cloneElement(child, { size, key: child.key ?? index }))}
        {overflow > 0 && (
          <span
            className={cn(styles.avatar, styles[size], styles.surface, styles.overflow)}
            data-component="avatar-overflow"
            data-size={size}
            role="img"
            aria-label={`${overflow} more`}
          >
            {`+${overflow}`}
          </span>
        )}
      </span>
    );
  },
);
