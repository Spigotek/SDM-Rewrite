import { Card } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";

/**
 * Right column of row 4 (K.1 mockup §10.1) — static announcements. v1.1.4
 * ships hardcoded copy per K-prompt; a tenant-scoped announcements feed
 * lands in v1.2 alongside notifications. Until then the values come straight
 * from the i18n catalog so localisation is correct.
 */
interface Announcement {
  readonly key: "wifi" | "catalog" | "vpn";
  readonly date: string;
}

const ANNOUNCEMENTS: ReadonlyArray<Announcement> = [
  { key: "wifi", date: "2026-06-13" },
  { key: "catalog", date: "2026-06-10" },
  { key: "vpn", date: "2026-06-08" },
];

function DotIcon({ tone }: { tone: "info" | "warn" | "success" }) {
  return <span className="sdm-home-announcement-dot" data-tone={tone} aria-hidden="true" />;
}

const TONE: Record<Announcement["key"], "info" | "warn" | "success"> = {
  wifi: "warn",
  catalog: "success",
  vpn: "info",
};

export function AnnouncementsCard() {
  const { t } = useTranslation("portal");
  return (
    <Card variant="surface" className="sdm-home-card" data-testid="home-announcements">
      <header className="sdm-home-card-head">
        <h2 className="sdm-home-card-title">{t("home.announcements.title")}</h2>
      </header>
      <ul className="sdm-home-announcement-list">
        {ANNOUNCEMENTS.map((a) => (
          <li
            key={a.key}
            className="sdm-home-announcement-row"
            data-testid={`home-announcement-${a.key}`}
          >
            <DotIcon tone={TONE[a.key]} />
            <span className="sdm-home-announcement-title">
              {t(`home.announcements.items.${a.key}.title`)}
            </span>
            <time className="sdm-home-announcement-date" dateTime={a.date}>
              {a.date}
            </time>
          </li>
        ))}
      </ul>
    </Card>
  );
}
