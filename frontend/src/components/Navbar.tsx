import React, { useEffect, useRef, useState } from 'react';
import logo from '../assets/logo.png'
import { NavLink, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
const link = 'hover:text-gray-300'
const active = 'underline underline-offset-8'
import { cn } from '../lib/utils.ts'
import { clearAuthSession, consumeAuthNotice, getStoredUser, setAuthNotice, subscribeToAuthChanges } from '@/lib/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import type { MeResponse } from '@/pages/Dashboard';

const API_BASE = import.meta.env?.VITE_BACKEND_API_URL ?? '';
const BACKEND = import.meta.env?.VITE_BACKEND_API_URL ?? 'http://localhost:5001';

const ADMIN_ROLES = new Set(['admin', 'officer']);
const PARTNER_ROLES = new Set(['partner', 'admin']);

interface UserNotification {
  notification_id: number;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
  schedule_id: number | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const Navbar: React.FC = () => {
    const navigate = useNavigate();
    const qc = useQueryClient();
    const [user, setUser] = useState(() => getStoredUser());
    const [notice, setNotice] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);
    const isAuthenticated = Boolean(user);

    useEffect(() => {
        return subscribeToAuthChanges(() => {
            setUser(getStoredUser());
        });
    }, []);

    useEffect(() => {
        const nextNotice = consumeAuthNotice();
        if (!nextNotice) return;
        setNotice({ msg: nextNotice, type: 'success' });
        const timeout = window.setTimeout(() => setNotice(null), 2600);
        return () => window.clearTimeout(timeout);
    }, []);

    useEffect(() => {
        if (!notice) return;
        const timeout = window.setTimeout(() => setNotice(null), 2600);
        return () => window.clearTimeout(timeout);
    }, [notice]);

    // Close both dropdowns when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setNotifOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const { data: navMe } = useQuery<MeResponse>({
        queryKey: ['dashboard-me'],
        queryFn: () => apiGet<MeResponse>('/dashboard/me'),
        enabled: isAuthenticated,
        staleTime: 60_000,
    });

    const { data: notifData } = useQuery<{ notifications: UserNotification[] }>({
        queryKey: ['user-notifications'],
        queryFn: () => apiGet('/notifications/user'),
        enabled: isAuthenticated,
        refetchInterval: 60_000,
        staleTime: 30_000,
    });

    const notifications = notifData?.notifications ?? [];
    const unreadCount = notifications.filter(n => !n.is_read).length;

    async function handleMarkRead(id: number) {
        await apiPatch(`/notifications/user/${id}/read`, {});
        qc.invalidateQueries({ queryKey: ['user-notifications'] });
    }

    async function handleMarkAllRead() {
        await apiPost('/notifications/user/read-all', {});
        qc.invalidateQueries({ queryKey: ['user-notifications'] });
    }

    async function handleLogout() {
        setDropdownOpen(false);
        try {
            const res = await fetch(`${API_BASE}/auth/logout`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('logout_failed');
        } catch {
            setNotice({ msg: 'Logout failed — please try again.', type: 'error' });
            return;
        }
        clearAuthSession();
        setNotice({ msg: 'You have been logged out.', type: 'success' });
        setAuthNotice('You have been logged out.');
        navigate('/', { replace: true });
    }

    const avatarUrl = navMe?.profile?.avatar_url ? `${BACKEND}${navMe.profile.avatar_url}` : null;
    const isAdmin = user?.role && ADMIN_ROLES.has(user.role);
    const isPartner = user?.role && PARTNER_ROLES.has(user.role);
    const initials = user?.email?.[0]?.toUpperCase() ?? '?';

    return (
        <>
            {notice ? (
                <div className={`px-4 py-2 text-center text-sm font-medium text-white shadow-sm ${notice.type === 'error' ? 'bg-red-700/90' : 'bg-emerald-600/90'}`}>
                    {notice.msg}
                </div>
            ) : null}
            <nav className="w-full bg-red-700 text-white p-4 flex justify-between items-center relative z-[100]">
                <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="flex items-center space-x-3 cursor-pointer focus:outline-none"
                >
                    <img src={logo} alt="CougarAI Logo" className="h-8 w-8 rounded" />
                    <span className="text-xl font-bold">CougarAI</span>
                </button>
                <ul className="flex items-center space-x-5">
                    <NavLink to="/" className={({isActive}) => cn(link, isActive && active)}>Home</NavLink>
                    {!isAuthenticated && (
                        <NavLink to="/about" className={({isActive}) => cn(link, isActive && active)}>About Us</NavLink>
                    )}
                    <NavLink to="/memberships" className={({isActive}) => cn(link, isActive && active)}>Memberships</NavLink>
                    <NavLink to="/contact" className={({isActive}) => cn(link, isActive && active)}>Contact</NavLink>
                    <NavLink to="/calendar" className={({isActive}) => cn(link, isActive && active)}>Events</NavLink>
                    {!isAuthenticated && (
                        <NavLink to="/sponsors" className={({isActive}) => cn(link, isActive && active)}>Sponsors</NavLink>
                    )}

                    {isAuthenticated ? (
                        <div className="flex items-center gap-3">
                            {/* Bell notification icon */}
                            <div className="relative" ref={notifRef}>
                                <button
                                    type="button"
                                    onClick={() => { setNotifOpen(o => !o); setDropdownOpen(false); }}
                                    className="relative flex items-center justify-center h-8 w-8 rounded-full hover:bg-red-800/60 transition-colors focus:outline-none"
                                    aria-label="Notifications"
                                >
                                    <Bell className="h-4 w-4" />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-white text-red-700 text-[10px] flex items-center justify-center font-bold leading-none">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </button>

                                {notifOpen && (
                                    <div
                                        className="absolute right-0 mt-2 w-80 rounded-xl border border-red-900/40 shadow-xl z-[9999] overflow-hidden"
                                        style={{ background: 'rgba(10,2,2,0.97)', backdropFilter: 'blur(12px)' }}
                                    >
                                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
                                            <span className="text-sm font-semibold text-white/90 font-['Oxanium']">Notifications</span>
                                            {unreadCount > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={handleMarkAllRead}
                                                    className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                                                >
                                                    Mark all read
                                                </button>
                                            )}
                                        </div>
                                        <div className="max-h-80 overflow-y-auto">
                                            {notifications.length === 0 ? (
                                                <div className="px-4 py-8 text-center text-white/30 text-sm">
                                                    No notifications
                                                </div>
                                            ) : (
                                                notifications.map(n => (
                                                    <button
                                                        key={n.notification_id}
                                                        type="button"
                                                        onClick={() => { if (!n.is_read) handleMarkRead(n.notification_id); }}
                                                        className="w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors"
                                                        style={!n.is_read ? { background: 'rgba(185,28,28,.08)' } : undefined}
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            {!n.is_read && (
                                                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                                                            )}
                                                            <div className={cn("flex flex-col gap-0.5 min-w-0", n.is_read && "ml-3.5")}>
                                                                <span className={cn("text-sm leading-snug truncate", n.is_read ? "text-white/50" : "text-white/90 font-medium")}>
                                                                    {n.title}
                                                                </span>
                                                                {n.body && (
                                                                    <span className="text-xs text-white/35 line-clamp-2 whitespace-pre-line">
                                                                        {n.body}
                                                                    </span>
                                                                )}
                                                                <span className="text-[10px] text-white/25 mt-0.5">
                                                                    {timeAgo(n.created_at)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Avatar dropdown */}
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => { setDropdownOpen(o => !o); setNotifOpen(false); }}
                                    className="flex items-center gap-1.5 cursor-pointer focus:outline-none"
                                    aria-label="User menu"
                                >
                                    {avatarUrl ? (
                                        <img
                                            src={avatarUrl}
                                            alt="Avatar"
                                            className="h-8 w-8 rounded-full object-cover ring-2 ring-white/30"
                                        />
                                    ) : (
                                        <span className="h-8 w-8 rounded-full bg-red-900 ring-2 ring-white/30 flex items-center justify-center text-sm font-semibold">
                                            {initials}
                                        </span>
                                    )}
                                    <svg className={cn("h-3 w-3 transition-transform", dropdownOpen && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {dropdownOpen && (
                                    <div
                                        className="absolute right-0 mt-2 w-44 rounded-xl border border-red-900/40 shadow-xl z-[9999] overflow-hidden"
                                        style={{ background: 'rgba(10,2,2,0.97)', backdropFilter: 'blur(12px)' }}
                                    >
                                        <div className="px-3 py-2 border-b border-white/10">
                                            <p className="text-xs text-white/50 truncate">{user?.email}</p>
                                        </div>
                                        <div className="py-1">
                                            <button
                                                type="button"
                                                onClick={() => { setDropdownOpen(false); navigate('/dashboard'); }}
                                                className="w-full text-left block px-4 py-2 text-sm text-white/90 hover:bg-white/10 transition-colors cursor-pointer"
                                            >
                                                Dashboard
                                            </button>
                                            {isAdmin && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setDropdownOpen(false); navigate('/admin'); }}
                                                    className="w-full text-left block px-4 py-2 text-sm text-white/90 hover:bg-white/10 transition-colors cursor-pointer"
                                                >
                                                    Admin
                                                </button>
                                            )}
                                            {isPartner && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setDropdownOpen(false); navigate('/partner'); }}
                                                    className="w-full text-left block px-4 py-2 text-sm text-white/90 hover:bg-white/10 transition-colors cursor-pointer"
                                                >
                                                    Partner
                                                </button>
                                            )}
                                        </div>
                                        <div className="border-t border-white/10 py-1">
                                            <button
                                                type="button"
                                                onClick={handleLogout}
                                                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/10 transition-colors cursor-pointer"
                                            >
                                                Logout
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <NavLink to="/auth" className={({isActive}) => cn(link, isActive && active)}>Login / Register</NavLink>
                    )}
                </ul>
            </nav>
        </>
    );
};

export default Navbar;
