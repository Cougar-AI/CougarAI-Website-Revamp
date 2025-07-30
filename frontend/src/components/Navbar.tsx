import React from 'react';
import logo from '../assets/logo.png'
import { Link } from 'react-router-dom';

const Navbar: React.FC = () => {
    return (
        <nav className="w-full bg-red-700 text-white p-4 flex justify-between items-center">
            <div className="flex items-center space-x-3">
                <img src={logo} alt="CougarAI Logo" className="h-8 w-8 rounded" />
                <span className="text-xl font-bold">CougarAI</span>
            </div>
        <ul className="flex space-x-5">
            <li><Link to="/" className="hover:text-gray-300">Home</Link></li>
            <li><Link to="/About" className="hover:text-gray-300">About Us</Link></li>
            <li><Link to="/Memberships" className="hover:text-gray-300">Memberships</Link></li>
            <li><Link to="/Contact" className="hover:text-gray-300">Contact</Link></li>
            <li><Link to="/Calendar" className="hover:text-gray-300">Calendar</Link></li>
            <li><Link to="/Sponsors" className="hover:text-gray-300">Sponsors</Link></li>
            <li><Link to="/Profile" className="hover:text-gray-300">Profile</Link></li>
        </ul>
        </nav>
    );
};

export default Navbar;