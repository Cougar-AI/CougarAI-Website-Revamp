import React, { useState } from 'react';
import {
  LayoutDashboard, Users, Calendar, Shield, ChevronDown, ChevronRight,
  Building2, Handshake, Tag, BarChart2, Star, UserSearch, ClipboardList, UserCheck,
} from 'lucide-react';

export type AdminTab =
  // Admin Tools
  | 'overview' | 'users' | 'officers' | 'sponsors' | 'partners' | 'event-types'
  // Officer Tools
  | 'events' | 'event-stats' | 'points' | 'members' | 'progress' | 'checkin';

interface TabDef {
  id: AdminTab;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
}

const ADMIN_TABS: TabDef[] = [
  { id: 'overview',    label: 'Overview',     icon: LayoutDashboard },
  { id: 'users',       label: 'Users',        icon: Users },
  { id: 'officers',    label: 'Officers',     icon: Shield },
  { id: 'sponsors',    label: 'Sponsors',     icon: Building2 },
  { id: 'partners',    label: 'Partners',     icon: Handshake },
  { id: 'event-types', label: 'Event Types',  icon: Tag },
];

const OFFICER_TABS: TabDef[] = [
  { id: 'events',      label: 'Events',       icon: Calendar },
  { id: 'event-stats', label: 'Event Stats',  icon: BarChart2 },
  { id: 'points',      label: 'Points',       icon: Star },
  { id: 'members',     label: 'Members',      icon: UserSearch },
  { id: 'progress',    label: 'Progress Reports', icon: ClipboardList },
  { id: 'checkin',     label: 'Check-In',     icon: UserCheck },
];

const ADMIN_TAB_IDS = new Set<AdminTab>(ADMIN_TABS.map((t) => t.id));
const OFFICER_TAB_IDS = new Set<AdminTab>(OFFICER_TABS.map((t) => t.id));

interface AdminShellProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  children: React.ReactNode;
  userRole?: string;
}

const glassCard = {
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(185,28,28,.22)',
  backdropFilter: 'blur(10px)',
} as const;

function SectionHeader({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-colors"
      style={{ color: 'rgba(248,113,113,.7)', letterSpacing: '0.08em' }}
    >
      <span>{label}</span>
      {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
    </button>
  );
}

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: TabDef;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left"
      style={
        active
          ? { background: 'rgba(185,28,28,.22)', color: '#fff', fontWeight: 600 }
          : { color: 'rgba(255,255,255,.6)' }
      }
    >
      <Icon size={15} />
      {tab.label}
    </button>
  );
}

export default function AdminShell({ activeTab, onTabChange, children, userRole }: AdminShellProps) {
  const isAdmin = userRole === 'admin';

  const activeIsAdmin = ADMIN_TAB_IDS.has(activeTab);
  const activeIsOfficer = OFFICER_TAB_IDS.has(activeTab);

  const [adminOpen, setAdminOpen] = useState(activeIsAdmin || isAdmin);
  const [officerOpen, setOfficerOpen] = useState(activeIsOfficer || !isAdmin);

  const visibleAdminTabs = isAdmin ? ADMIN_TABS : [];
  const visibleOfficerTabs = OFFICER_TABS;

  // Mobile: flat list of all accessible tabs in order
  const mobileTabs: TabDef[] = [
    ...(isAdmin ? ADMIN_TABS : []),
    ...OFFICER_TABS,
  ];

  return (
    <div className="min-h-screen" style={{ background: 'transparent' }}>
      <div className="max-w-screen-xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 rounded-xl"
          style={glassCard}
        >
          <div className="flex items-center gap-3">
            <Shield size={22} className="text-red-400" />
            <h1 className="text-xl font-bold text-white font-['Oxanium']">
              {isAdmin ? 'Admin Panel' : 'Officer Panel'}
            </h1>
          </div>
          {userRole && (
            <span
              className="text-xs px-3 py-1 rounded-full font-medium uppercase tracking-wide"
              style={{ background: 'rgba(185,28,28,.25)', color: 'rgba(248,113,113,.9)', border: '1px solid rgba(185,28,28,.3)' }}
            >
              {userRole}
            </span>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">

          {/* Sidebar — desktop */}
          <aside className="hidden lg:flex flex-col gap-2 w-52 shrink-0">
            <div className="rounded-xl p-3 flex flex-col gap-1" style={glassCard}>

              {/* Admin Tools section */}
              {isAdmin && (
                <div className="flex flex-col gap-0.5">
                  <SectionHeader
                    label="Admin Tools"
                    open={adminOpen}
                    onToggle={() => setAdminOpen((o) => !o)}
                  />
                  {adminOpen && visibleAdminTabs.map((tab) => (
                    <TabButton
                      key={tab.id}
                      tab={tab}
                      active={activeTab === tab.id}
                      onClick={() => onTabChange(tab.id)}
                    />
                  ))}
                  <div
                    className="my-2 mx-2"
                    style={{ height: '1px', background: 'rgba(185,28,28,.12)' }}
                  />
                </div>
              )}

              {/* Officer Tools section */}
              <div className="flex flex-col gap-0.5">
                <SectionHeader
                  label="Officer Tools"
                  open={officerOpen}
                  onToggle={() => setOfficerOpen((o) => !o)}
                />
                {officerOpen && visibleOfficerTabs.map((tab) => (
                  <TabButton
                    key={tab.id}
                    tab={tab}
                    active={activeTab === tab.id}
                    onClick={() => onTabChange(tab.id)}
                  />
                ))}
              </div>

            </div>
          </aside>

          {/* Mobile tab row — flat scrollable */}
          <div
            className="flex lg:hidden overflow-x-auto gap-1 rounded-xl p-2 shrink-0"
            style={glassCard}
          >
            {mobileTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all shrink-0"
                  style={
                    activeTab === tab.id
                      ? { background: 'rgba(185,28,28,.25)', color: '#fff', fontWeight: 600 }
                      : { color: 'rgba(255,255,255,.6)' }
                  }
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Main content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>

      </div>
    </div>
  );
}
