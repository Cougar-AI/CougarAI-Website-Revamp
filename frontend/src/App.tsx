import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import RootLayout from './layouts/RootLayout.tsx';
import AppLoading from './components/AppLoading.tsx';
import ErrorFallback from './components/ErrorFallback.tsx';

// const Home = lazy(() => import('./pages/Home.tsx'));
// Maybe implement the above for performance (like if bgphoto.jpg is too big)
import Home from './pages/Home.tsx';
import About from './pages/About.tsx';
import Memberships from './pages/Memberships.tsx';
import Contact from './pages/Contact.tsx';
import Calendar from './pages/Calendar.tsx';
import Sponsors from './pages/Sponsors.tsx';
import Login from './pages/Login.tsx';
import NotFound from './pages/NotFound.tsx';
import Registration from './pages/Registration.tsx';
import Join from './pages/Join.tsx'; 

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
            <Route path={'/login'} element={<Login />} />
            <Route path={'/register'} element={<Registration />} />
            <Route path={'/join'} element={<Join />} />

            {/* Real 404 */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </Suspense>
  );
}
