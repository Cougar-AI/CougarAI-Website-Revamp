import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';
import Memberships from './pages/Memberships';
import Contact from './pages/Contact';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/memberships" element={<Memberships />} />
      <Route path="/contacts" element={<Contact />} />
    </Routes>
  );
}

export default App;
