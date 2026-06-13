import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";
import styles from "./Breadcrumbs.module.css";

export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
}

export interface BreadcrumbsProps extends Omit<HTMLAttributes<HTMLElement>, "aria-label"> {
  items: BreadcrumbItem[];
  "aria-label"?: string;
}

const TRUNCATION_THRESHOLD = 4;

type RenderEntry = { type: "item"; item: BreadcrumbItem; isLast: boolean } | { type: "ellipsis" };

function buildEntries(items: BreadcrumbItem[]): { entries: RenderEntry[]; hiddenCount: number } {
  if (items.length <= TRUNCATION_THRESHOLD) {
    const entries: RenderEntry[] = items.map((item, idx) => ({
      type: "item",
      item,
      isLast: idx === items.length - 1,
    }));
    return { entries, hiddenCount: 0 };
  }

  const first = items[0]!;
  const secondToLast = items[items.length - 2]!;
  const last = items[items.length - 1]!;
  const hiddenCount = items.length - 3;

  return {
    entries: [
      { type: "item", item: first, isLast: false },
      { type: "ellipsis" },
      { type: "item", item: secondToLast, isLast: false },
      { type: "item", item: last, isLast: true },
    ],
    hiddenCount,
  };
}

export const Breadcrumbs = forwardRef<HTMLElement, BreadcrumbsProps>(
  function Breadcrumbs(props, ref) {
    const { items, className, "aria-label": ariaLabel = "Breadcrumbs", ...rest } = props;
    const { entries, hiddenCount } = buildEntries(items);

    return (
      <nav
        ref={ref}
        aria-label={ariaLabel}
        className={cn(styles.nav, className)}
        data-component="breadcrumbs"
        {...rest}
      >
        {hiddenCount > 0 ? (
          <span className={styles.srOnly}>{`${hiddenCount} items hidden`}</span>
        ) : null}
        <ol className={styles.list}>
          {entries.map((entry, idx) => {
            const isLastEntry = idx === entries.length - 1;
            const separator = isLastEntry ? null : (
              <span className={styles.separator} aria-hidden="true">
                /
              </span>
            );

            if (entry.type === "ellipsis") {
              return (
                <li key={idx} className={styles.item}>
                  <span className={styles.ellipsis} aria-hidden="true">
                    …
                  </span>
                  {separator}
                </li>
              );
            }

            const { item } = entry;
            let crumb: ReactNode;
            if (entry.isLast) {
              crumb = (
                <span className={styles.current} aria-current="page">
                  {item.label}
                </span>
              );
            } else if (item.href) {
              crumb = (
                <a href={item.href} className={styles.link}>
                  {item.label}
                </a>
              );
            } else {
              crumb = <span className={styles.crumb}>{item.label}</span>;
            }

            return (
              <li key={idx} className={styles.item}>
                {crumb}
                {separator}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  },
);
