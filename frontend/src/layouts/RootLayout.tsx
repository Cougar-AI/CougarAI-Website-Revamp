import { Outlet } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import bg from '@/assets/bgphoto.jpg';

export default function RootLayout() {
  return (
    <div
      className="flex min-h-screen flex-col text-white bg-cover bg-center"
      style={{ backgroundImage: `url(${bg})` }}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 rounded bg-white px-3 py-1 text-black">
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
