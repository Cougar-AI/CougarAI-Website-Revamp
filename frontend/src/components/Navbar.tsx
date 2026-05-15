import React, { useEffect, useState } from 'react';
import logo from '../assets/logo.png'
import { NavLink, useNavigate } from 'react-router-dom';
const link = 'hover:text-gray-300'
const active = 'underline underline-offset-8'
import { cn } from '../lib/utils.ts'
import { clearAuthSession, consumeAuthNotice, getStoredUser, setAuthNotice, subscribeToAuthChanges } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { MeResponse } from '@/pages/Dashboard';

const API_BASE = import.meta.env?.VITE_BACKEND_API_URL ?? '';
const BACKEND = import.meta.env?.VITE_BACKEND_API_URL ?? 'http://localhost:5001';

const OFFICER_ROLES = new Set(['officer', 'webmaster', 'admin']);

const Navbar: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(() => getStoredUser());
    const [notice, setNotice] = useState<string | null>(null);
    const isAuthenticated = Boolean(user);

    useEffect(() => {
        return subscribeToAuthChanges(() => {
            setUser(getStoredUser());
        });
    }, []);

    useEffect(() => {
        const nextNotice = consumeAuthNotice();
        if (!nextNotice) return;
        setNotice(nextNotice);
        const timeout = window.setTimeout(() => setNotice(null), 2600);
        return () => window.clearTimeout(timeout);
    }, []);

    useEffect(() => {
        if (!notice) return;
        const timeout = window.setTimeout(() => setNotice(null), 2600);
        return () => window.clearTimeout(timeout);
    }, [notice]);

    const { data: navMe } = useQuery<MeResponse>({
        queryKey: ['dashboard-me'],
        queryFn: () => apiGet<MeResponse>('/dashboard/me'),
        enabled: isAuthenticated,
        staleTime: 60_000,
    });

    async function handleLogout() {
        try {
            await fetch(`${API_BASE}/auth/logout`, {
                method: 'DELETE',
                credentials: 'include',
            });
        } catch {
            // Still clear local auth state even if the request fails.
        } finally {
            clearAuthSession();
            setNotice('You have been logged out.');
            setAuthNotice('You have been logged out.');
            navigate('/', { replace: true });
        }
    }

    const avatarUrl = navMe?.profile?.avatar_url ? `${BACKEND}${navMe.profile.avatar_url}` : null;
    const isOfficer = user?.role && OFFICER_ROLES.has(user.role);

    return (
        <>
            {notice ? (
                <div className="bg-emerald-600/90 px-4 py-2 text-center text-sm font-medium text-white shadow-sm">
                    {notice}
                </div>
            ) : null}
            <nav className="w-full bg-red-700 text-white p-4 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <img src={logo} alt="CougarAI Logo" className="h-8 w-8 rounded" />
                    <span className="text-xl font-bold">CougarAI</span>
                </div>
            <ul className="flex items-center space-x-5">
                <NavLink to="/" className={({isActive}) => cn(link, isActive && active)}>Home</NavLink>
                <NavLink to="/about" className={({isActive}) => cn(link, isActive && active)}>About Us</NavLink>
                <NavLink to="/memberships" className={({isActive}) => cn(link, isActive && active)}>Memberships</NavLink>
                <NavLink to="/contact" className={({isActive}) => cn(link, isActive && active)}>Contact</NavLink>
                <NavLink to="/calendar" className={({isActive}) => cn(link, isActive && active)}>Calendar</NavLink>
                <NavLink to="/sponsors" className={({isActive}) => cn(link, isActive && active)}>Sponsors</NavLink>
                {isAuthenticated ? (
                    <>
                        <NavLink to="/dashboard" className={({isActive}) => cn(link, isActive && active)}>Dashboard</NavLink>
                        {isOfficer && (
                            <NavLink to="/officer" className={({isActive}) => cn(link, isActive && active)}>Officer</NavLink>
                        )}
                        <div className="flex items-center gap-2">
                            {avatarUrl ? (
                                <NavLink to="/dashboard">
                                    <img
                                        src={avatarUrl}
                                        alt="Avatar"
                                        className="h-8 w-8 rounded-full object-cover ring-2 ring-white/20"
                                    />
                                </NavLink>
                            ) : (
                                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white/95">
                                    {user?.email}
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className={cn(link, 'cursor-pointer')}
                        >
                            Logout
                        </button>
                    </>
                ) : (
                    <NavLink to="/auth" className={({isActive}) => cn(link, isActive && active)}>Login / Register</NavLink>
                )}
            </ul>
            </nav>
        </>
    );
};

export default Navbar;
