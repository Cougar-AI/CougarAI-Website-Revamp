import { useState } from 'react'
import { Link } from 'react-router-dom'
import './App.css'
import Navbar from './components/Navbar';
import logo from './assets/logo.png';
import Slideshow from './components/Slideshow';

function App() {
  return (
    <div 
      className="text-white bg-cover bg-center min-h-screen w-full"
      style={{ backgroundImage: "url('/bgphoto.jpg')" }}
    >
      <Navbar />
      <main className="px-4 py-8 flex flex-col items-center justify-center w-full max-w-7xl mx-auto">
        {/* Big welcome logo */}
        <img
          src={logo}
          alt="CougarAI Logo"
          className="w-48 h-48 md:w-64 md:h-64 lg:w-80 lg:h-80 border-8 border-red-700 rounded-xl mb-16 mt-12"
        />

        <h1 className="text-3xl font-bold">Welcome to CougarAI! Here we offer... </h1>

        {/* Containers with org features. */}
        <section className="bg-red-700 p-8 rounded-xl max-w-10xl w-[90%] mx-auto mt-16">
          <div className="flex flex-col md:flex-row justify-center gap-8 text-black">
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

        {/* Learn more section */}
        <h2 className="font-bold text-lg mt-16">If interested in joining please click the button below!</h2>
        <Link to="#">
            <button className="font-bold bg-red-700 hover:bg-red-800 text-white py-2 px-4 rounded mt-10 mb-16">
              Learn More
            </button>
        </Link>
        
        <Slideshow />
            
        
      </main>
    </div>
  )
}

export default App
