import { useMemo } from "react";
import { useTranslation } from "@sdm/i18n";
import { buildAttributeGroups, DEFAULT_COLLAPSED } from "../lib/attribute-groups";
import { useAttributeGroupCollapse } from "../hooks";
import type { AttributeGroup, CiDetail } from "../types";

/**
 * Attributes tab — repeats one `<CIAttributeGroup>` block per group. Each
 * group is a `<details>` element so the native disclosure widget gives us
 * keyboard + screen-reader semantics for free; we layer on the per-user
 * persistence (`localStorage.cmdbCiCollapse:{class}.{group}`) via a controlled
 * `open` attribute fed by `useAttributeGroupCollapse`.
 *
 * Why `<details>` instead of a custom `aria-expanded` button: it ships with
 * built-in `summary` rotation, ESC-to-collapse on focus, and screen readers
 * announce "expanded/collapsed group" — re-implementing that with buttons +
 * regions is a lot of code for the same UX.
 */

export interface AttributeGroupsProps {
  readonly detail: CiDetail;
}

export function AttributeGroups({ detail }: AttributeGroupsProps) {
  const { t } = useTranslation("workspace");
  const groups = useMemo(() => buildAttributeGroups(detail), [detail]);

  return (
    <section
      role="tabpanel"
      id="cmdb-tabpanel-attributes"
      aria-labelledby="cmdb-tab-attributes"
      data-testid="cmdb-tabpanel-attributes"
      className="sdm-cmdb-tabpanel"
    >
      <header className="sdm-cmdb-attributes-header">
        <h2>{t("cmdb.attributes.title")}</h2>
        <span className="sdm-cmdb-attributes-count" data-testid="cmdb-attributes-count">
          {t("cmdb.attributes.count", {
            count: groups.reduce((sum, g) => sum + g.rows.length, 0),
          })}
        </span>
      </header>
      {groups.length === 0 ? (
        <p className="sdm-cmdb-detail-empty" data-testid="cmdb-attributes-empty">
          {t("cmdb.attributes.empty")}
        </p>
      ) : (
        <div className="sdm-cmdb-attribute-groups">
          {groups.map((g) => (
            <AttributeGroupSection key={g.key} ciClass={detail.class} group={g} />
          ))}
        </div>
      )}
    </section>
  );
}

interface AttributeGroupSectionProps {
  readonly ciClass: string;
  readonly group: AttributeGroup;
}

function AttributeGroupSection({ ciClass, group }: AttributeGroupSectionProps) {
  const { t } = useTranslation("workspace");
  const defaultCollapsed = DEFAULT_COLLAPSED[group.key];
  const { collapsed, toggle } = useAttributeGroupCollapse(ciClass, group.key, defaultCollapsed);

  // `<details>` consumes a synthetic toggle event; bind our controlled state
  // through the `open` prop so React owns the source of truth.
  return (
    <details
      open={!collapsed}
      data-testid={`cmdb-attribute-group-${group.key}`}
      data-group={group.key}
      className="sdm-cmdb-attribute-group"
    >
      <summary
        className="sdm-cmdb-attribute-group-summary"
        onClick={(e) => {
          // Prevent the native toggle so we control state via our hook.
          e.preventDefault();
          toggle();
        }}
      >
        <span className="sdm-cmdb-attribute-group-title">
          {t(`cmdb.attributeGroup.${group.key}`)}
        </span>
        <span className="sdm-cmdb-attribute-group-count">{group.rows.length}</span>
      </summary>
      <dl className="sdm-cmdb-attribute-list">
        {group.rows.map((row) => (
          <div key={row.label} className="sdm-cmdb-attribute-row" data-attr={row.label}>
            <dt>{t(`cmdb.attribute.${row.label}`, { defaultValue: row.label })}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
