import { Button } from "@sdm/design-system";
import { useSession } from "./session-context";
import { TenantSwitcher } from "./tenant-switcher";

export function TopBar({ appName }: { appName: string }) {
  const { session, status, logout } = useSession();
  return (
    <header className="sdm-top-bar" data-testid="top-bar">
      <div className="sdm-brand">
        <span className="sdm-logo" aria-hidden="true">
          SDM
        </span>
        <span className="sdm-app-name">{appName}</span>
      </div>
      {status === "ready" && session && (
        <>
          <TenantSwitcher />
          <div className="sdm-user-pill" data-testid="user-pill">
            <span className="sdm-user-name">{session.displayName}</span>
            <span className="sdm-user-roles">
              {session.roles.length > 0 ? session.roles.join(", ") : "no roles"}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void logout()}
            data-testid="logout-button"
          >
            Odhlásiť
          </Button>
        </>
      )}
    </header>
  );
}
