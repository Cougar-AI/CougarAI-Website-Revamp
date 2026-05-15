import { Navigate, Routes, Route } from 'react-router-dom';
import { Suspense } from 'react';
import RootLayout from './layouts/RootLayout.tsx';
import AppLoading from './components/AppLoading.tsx';
import ErrorFallback from './components/ErrorFallback.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';

import Home from './pages/Home.tsx';
import About from './pages/about.tsx';
import Memberships from './pages/Memberships.tsx';
import Contact from './pages/contact.tsx';
import Calendar from './pages/Calendar.tsx';
import Sponsors from './pages/Sponsors.tsx';
import Auth from './pages/Auth.tsx';
import NotFound from './pages/NotFound.tsx';
import AuthSuccess from './pages/AuthSuccess.tsx';
import Join from './pages/Join.tsx';
import ForgotPassword from './pages/ForgotPassword.tsx';
import VerifyEmail from './pages/VerifyEmail.tsx';
import Terms from './pages/Terms.tsx';
import Privacy from './pages/Privacy.tsx';
import Sponsorships from './pages/Sponsorships.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Onboarding from './pages/Onboarding.tsx';
import OfficerPortal from './pages/OfficerPortal.tsx';

function ErrorBoundary({ children }: { children: React.ReactNode }) {
  try {
    return <>{children}</>;
  } catch (e) {
    return <ErrorFallback error={e as Error} />;
  }
}

export default function App() {
  return (
    <Suspense fallback={<AppLoading />}>
      <ErrorBoundary>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path={'/'} element={<Home />} />
            <Route path={'/about'} element={<About />} />
            <Route path={'/memberships'} element={<Memberships />} />
            <Route path={'/contact'} element={<Contact />} />
            <Route path={'/calendar'} element={<Calendar />} />
            <Route path={'/sponsors'} element={<Sponsors />} />
            <Route path={'/auth'} element={<Auth />} />
            <Route path={'/login'} element={<Navigate to="/auth?mode=login" replace />} />
            <Route path={'/register'} element={<Navigate to="/auth?mode=register" replace />} />
            <Route path={'/auth/success'} element={<AuthSuccess />} />
            <Route path={'/join'} element={<Join />} />
            <Route path={'/forgot-password'} element={<ForgotPassword />} />
            <Route path={'/verify-email'} element={<VerifyEmail />} />
            <Route path={'/terms'} element={<Terms />} />
            <Route path={'/privacy'} element={<Privacy />} />
            <Route path={'/sponsorships'} element={<Sponsorships />} />

            {/* Protected routes */}
            <Route
              path={'/dashboard'}
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path={'/onboarding'}
              element={
                <ProtectedRoute skipOnboardingCheck>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path={'/officer'}
              element={
                <ProtectedRoute requiredRole={["officer", "webmaster", "admin"]}>
                  <OfficerPortal />
                </ProtectedRoute>
              }
            />

            {/* Real 404 */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </Suspense>
  );
}
