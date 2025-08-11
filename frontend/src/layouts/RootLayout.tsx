import { Outlet } from 'react-router-dom'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col text-white bg-cover bg-center" style={{ backgroundImage: "url('/bgphoto.jpg')" }}>
      <Navbar />
      <main className="flex-1 px-4 py-8 w-full max-w-7xl mx-auto">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
