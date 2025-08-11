import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import Slideshow from '../components/Slideshow';

const Home = () => {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <img
        src={logo}
        alt="CougarAI Logo"
        className="w-48 h-48 md:w-64 md:h-64 lg:w-72 lg:h-72 border-8 border-red-700 rounded-xl mb-10 mt-6 mx-auto"
      />

      <h1 className="text-3xl font-bold">Welcome to CougarAI! Here we offer…</h1>

      {/* Feature cards wrapped in a narrow panel to match other pages */}
      <section className="mt-10 rounded-xl bg-red-700/90 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-black">
          {[
            { title: 'Workshops', desc: 'Hands-on sessions on ML/AI topics.' },
            { title: 'Research', desc: 'Group projects with real sponsors.' },
            { title: 'Community', desc: 'A welcoming place to learn together.' },
          ].map((item, i) => (
            <div key={i} className="bg-white p-4 rounded-xl shadow-md">
              <h3 className="font-bold text-lg">{item.title}</h3>
              <p className="mt-2 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Learn more */}
      <h2 className="font-bold text-lg mt-12">If interested in joining please click the button below!</h2>
      <Link to="/Memberships">
        <button className="font-bold bg-red-700 hover:bg-red-800 text-white py-2 px-4 rounded mt-6">
          Learn More
        </button>
      </Link>

      {/* Keep slideshow within the same content width */}
      <div className="mt-12">
        <Slideshow />
      </div>

      <h2 className="font-bold text-lg mt-12">Already a member?</h2>
      <Link to="/Memberships">
        <button className="font-bold bg-red-700 hover:bg-red-800 text-white py-2 px-4 rounded mt-6">
          Login
        </button>
      </Link>
    </div>
  );
};

export default Home;
