import React from 'react';
import logo from '../assets/logo.png'

const Navbar: React.FC = () => {
    return (
        <nav className="w-full bg-red-700 text-white p-4 flex justify-between items-center">
            <div className="flex items-center space-x-3">
                <img src={logo} alt="CougarAI Logo" className="h-8 w-8 rounded" />
                <span className="text-xl font-bold">CougarAI</span>
            </div>
        <ul className="flex space-x-5">
            <li><a href="/" className="hover:text-gray-300">Home</a></li>
            <li><a href="/About" className="hover:text-gray-300">About Us</a></li>
            <li><a href="/Memberships" className="hover:text-gray-300">Memberships</a></li>
            <li><a href="/Contact" className="hover:text-gray-300">Contact</a></li>
            <li><a href="/Calendar" className="hover:text-gray-300">Calendar</a></li>
            <li><a href="/Sponsorships" className="hover:text-gray-300">Sponsorships</a></li>
        </ul>
        </nav>
    );
};

export default Navbar;