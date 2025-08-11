import React from 'react';
import logo from '../assets/logo.png'
import { Link, NavLink } from 'react-router-dom';
const link = 'hover:text-gray-300'
const active = 'underline underline-offset-8'
import { cn } from '../lib/utils.ts'

const Navbar: React.FC = () => {
    return (
        <nav className="w-full bg-red-700 text-white p-4 flex justify-between items-center">
            <div className="flex items-center space-x-3">
                <img src={logo} alt="CougarAI Logo" className="h-8 w-8 rounded" />
                <span className="text-xl font-bold">CougarAI</span>
            </div>
        <ul className="flex space-x-5">
            <NavLink to="/" className={({isActive}) => cn(link, isActive && active)}>Home</NavLink>
            <NavLink to="/About" className={({isActive}) => cn(link, isActive && active)}>About Us</NavLink>
            <NavLink to="/Memberships" className={({isActive}) => cn(link, isActive && active)}>Memberships</NavLink>
            <NavLink to="/Contact" className={({isActive}) => cn(link, isActive && active)}>Contact</NavLink>
            <NavLink to="/Calendar" className={({isActive}) => cn(link, isActive && active)}>Calendar</NavLink>
            <NavLink to="/Sponsors" className={({isActive}) => cn(link, isActive && active)}>Sponsors</NavLink>
            <NavLink to="/Profile" className={({isActive}) => cn(link, isActive && active)}>Profile</NavLink>
        </ul>
        </nav>
    );
};

export default Navbar;