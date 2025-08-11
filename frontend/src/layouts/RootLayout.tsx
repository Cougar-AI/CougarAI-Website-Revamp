import { Outlet } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import bg from '@/assets/bgphoto.jpg';

export default function RootLayout() {
  return (
    <div
      className="relative flex min-h-screen flex-col text-white bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url(${bg})` }}
    >
      {/* Background overlay for consistent contrast */}
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

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