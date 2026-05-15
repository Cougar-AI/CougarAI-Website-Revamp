import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

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

export function ProtectedRoute({ children, skipOnboardingCheck, requiredRole }: Props) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/auth?mode=login" state={{ from: location.pathname }} replace />;
  }

  if (!skipOnboardingCheck && !user?.onboarding_completed) {
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
