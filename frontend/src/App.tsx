import { Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import RootLayout from './layouts/RootLayout'

const Home = lazy(() => import('./pages/home'))
const About = lazy(() => import('./pages/about'))
const Memberships = lazy(() => import('./pages/memberships'))
const Contact = lazy(() => import('./pages/contact'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Sponsors = lazy(() => import('./pages/Sponsors'))
const Profile = lazy(() => import('./pages/Profile'))

export default function App() {
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/memberships" element={<Memberships />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/sponsors" element={<Sponsors />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
