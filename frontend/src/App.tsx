import { useState } from 'react'
import './App.css'
import Navbar from './components/Navbar';
import logo from './assets/logo.png';

function App() {
  const [count, setCount] = useState(0)

  return (
    <div 
      className="text-white bg-cover bg-center min-h-screen w-full"
      style={{ backgroundImage: "url('/bgphoto.jpg')" }}
    >
      <Navbar />
      <main className="p-4 flex flex-col items-center justify-center">
        {/* Big welcome logo */}
        <img
          src={logo}
          alt="CougarAI Logo"
          className="w-80 h-80 border-20 border-red-700 rounded-xl mb-6 mt-6"
        />

        <h1 className="text-3xl font-bold">Welcome to CougarAI! Here we offer... </h1>

        {/* Containers with org features. */}
        <section className="bg-red-700 p-8 rounded-xl max-w-5xl w-[85%] mx auto mt-6">
          <div className="flex flex-col md:flex-row justify-center gap-6 text-black">
            {[
              /* Features with their descriptions */
              { title: 'Workshops', desc: 'We host workshops to teach students about various topics regarding machine learning and artificial intelligence.'},
              { title: 'Research', desc: 'We provide many research opportunities with group projects backed by companies.'},
              { title: 'Community', desc: 'Our goal is to build an open and welcoming community for anyone and everyone to learn about the beautiful world of ML/AI.'}
            ].map((item, index) => (
              <div key={index} className="bg-white p-4 rounded-xl shadow-md w-full md:w-1/3 text-center">
                <h3 className="font-bold text-lg">{item.title}</h3>
                <p className="mt-2 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
export default App
