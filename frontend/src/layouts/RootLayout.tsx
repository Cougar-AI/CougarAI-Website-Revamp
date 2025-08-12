import { Outlet } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SiteBackground from '@/components/SiteBackground';

export default function RootLayout() {
  return (
    <div
      className="
        relative isolate flex min-h-screen flex-col bg-black text-white
        [--accent:#e11d48] [--accent2:#2563eb] [--accent3:#22c55e]
      "
    >
      <SiteBackground />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 rounded bg-white px-3 py-1 text-black z-50"
      >
        Skip to content
      </a>

      <div className="relative z-10">
        <Navbar />
      </div>

      <main id="main" className="relative z-10 flex-1 w-full px-4 py-8">
        <Outlet />
      </main>

      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
