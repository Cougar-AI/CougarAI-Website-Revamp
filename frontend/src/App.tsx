import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';
import Memberships from './pages/Memberships';
import Contact from './pages/Contact';
import Calendar from './pages/Calendar';
import Sponsors from './pages/Sponsors';
import Profile from './pages/Profile';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/memberships" element={<Memberships />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/calendar" element={<Calendar />} />
      <Route path="/sponsors" element={<Sponsors />} />
      <Route path="/profile" element={<Profile />} />
    </Routes>
  );
}

export default App;
