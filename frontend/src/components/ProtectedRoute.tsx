import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { setPendingCheckinCode } from "@/lib/auth";

interface Props {
  children: React.ReactNode;
  skipOnboardingCheck?: boolean;
  requiredRole?: string | string[];
}

function AccessDenied() {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          background: "rgba(255,255,255,.04)",
          border: "1px solid rgba(185,28,28,.22)",
          borderRadius: 20,
          backdropFilter: "blur(10px)",
          padding: "48px 64px",
          textAlign: "center",
        }}
      >
        <h2 style={{ color: "rgba(248,113,113,.9)", fontFamily: "Oxanium,sans-serif", fontSize: 24, marginBottom: 8 }}>
          Access Restricted
        </h2>
        <p style={{ color: "rgba(255,255,255,.5)", fontSize: 14 }}>
          You don't have permission to view this page.
        </p>
      </div>
    </div>
  );
}

// If we're being redirected away from /checkin?code=X, stash the code in
// sessionStorage before the redirect happens. This is what allows the code to
// survive the register -> verify-email -> login -> onboarding hop chain — the
// query string itself gets dropped along the way, so the `from` state alone
// isn't enough once the user has to leave /auth to go create an account.
function persistPendingCodeFromLocation(pathname: string, search: string) {
  if (pathname !== "/checkin") return;
  const code = new URLSearchParams(search).get("code");
  if (code) {
    setPendingCheckinCode(code);
  }
}

export function ProtectedRoute({ children, skipOnboardingCheck, requiredRole }: Props) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Preserve the full path + query string (not just pathname) so a pending
    // check-in code (e.g. /checkin?code=X) survives the redirect through login.
    persistPendingCodeFromLocation(location.pathname, location.search);
    return (
      <Navigate
        to="/auth?mode=login"
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  }

  // Non-default roles imply onboarding was already completed at some point.
  // This prevents a stale stored-user object (missing the field) from blocking navigation.
  const isOnboarded = user?.onboarding_completed || (user?.role && user.role !== 'non-member');
  if (!skipOnboardingCheck && !isOnboarded) {
    // Authenticated but not onboarded yet — persist the code so
    // Onboarding.handleFinish can redirect back to /checkin?code=X afterward.
    persistPendingCodeFromLocation(location.pathname, location.search);
    return <Navigate to="/onboarding" replace />;
  }

  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!user?.role || !allowed.includes(user.role)) {
      return <AccessDenied />;
    }
  }

  return <>{children}</>;
}
