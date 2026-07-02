import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { Users, Calendar, DollarSign, TrendingUp, Star, Clock, Megaphone, Trash2, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/dates';

interface AdminStats {
  total_users: number;
  active_members: number;
  new_signups_7d: number;
  events_this_month: number;
  upcoming_events_count: number;
  revenue_this_month: number;
  total_points_awarded: number;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.FC<{ size?: number }>;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-2"
      style={{
        background: 'rgba(255,255,255,.04)',
        border: '1px solid rgba(185,28,28,.22)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg" style={{ background: 'rgba(185,28,28,.15)' }}>
          <Icon size={16} />
        </div>
        <span className="text-xs text-white/50 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-3xl font-bold text-white font-['Oxanium']">{value}</p>
      {sub && <p className="text-xs text-white/40">{sub}</p>}
    </div>
  );
}

interface PinnedAnnouncement {
  id: number;
  message: string;
  created_at: string;
  expires_at: string | null;
}

function AnnouncementCard() {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const { data } = useQuery<{ announcement: PinnedAnnouncement | null }>({
    queryKey: ['admin-pinned-announcement'],
    queryFn: () => apiGet('/admin/pinned-announcement'),
    staleTime: 30_000,
  });

  const pin = useMutation({
    mutationFn: () => apiPost('/admin/pinned-announcement', { message, expires_at: expiresAt || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pinned-announcement'] });
      setMessage('');
      setExpiresAt('');
    },
  });

  const remove = useMutation({
    mutationFn: () => apiDelete('/admin/pinned-announcement'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-pinned-announcement'] }),
  });

  const active = data?.announcement;

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.22)', backdropFilter: 'blur(10px)' }}
    >
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg" style={{ background: 'rgba(185,28,28,.15)' }}>
          <Megaphone size={16} style={{ color: 'rgba(248,113,113,.9)' }} />
        </div>
        <span className="text-sm font-semibold text-white/80 font-['Oxanium']">Pinned Announcement</span>
      </div>

      {active ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg p-3" style={{ background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.2)' }}>
            <p className="text-sm text-amber-200/90">{active.message}</p>
            {active.expires_at && (
              <p className="text-xs text-white/30 mt-1">
                Expires: {formatDate(active.expires_at)}
              </p>
            )}
          </div>
          <button
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs self-start transition-all"
            style={{ background: 'rgba(185,28,28,.2)', color: 'rgba(248,113,113,.8)', border: '1px solid rgba(185,28,28,.3)' }}
          >
            <Trash2 size={11} /> Remove announcement
          </button>
        </div>
      ) : (
        <p className="text-xs text-white/30">No active announcement.</p>
      )}

      <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <p className="text-xs text-white/40 uppercase tracking-wide">Post new announcement</p>
        <textarea
          className="w-full rounded-lg px-3 py-2 text-sm text-white resize-none"
          style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.2)', outline: 'none', minHeight: 72 }}
          placeholder="Type announcement message…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
        />
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5 flex-1">
            <label className="text-xs text-white/30">Expires (optional)</label>
            <input
              type="datetime-local"
              className="rounded-lg px-2 py-1.5 text-xs text-white/70"
              style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(185,28,28,.15)', outline: 'none' }}
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <button
            onClick={() => pin.mutate()}
            disabled={!message.trim() || pin.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all self-end"
            style={{ background: 'rgba(185,28,28,.7)', color: 'white', opacity: !message.trim() ? 0.4 : 1 }}
          >
            {pin.isPending ? 'Pinning…' : 'Pin'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminOverviewTab() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading, error } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: () => apiGet<AdminStats>('/admin/stats'),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-5 h-32 animate-pulse"
            style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.12)' }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    const status = (error as { status?: number })?.status;
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return (
      <div className="rounded-xl p-6 text-center" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(185,28,28,.22)' }}>
        <p className="text-red-400">
          Failed to load stats{status ? ` (${status})` : ''}: {msg}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AnnouncementCard />
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/50 uppercase tracking-wide">Stats</h3>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-stats'] })}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/50 hover:text-white transition-colors"
          style={{ background: 'rgba(255,255,255,.06)' }}
          title="Refresh stats"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats?.total_users ?? 0}
          sub="All registered accounts"
        />
        <StatCard
          icon={Star}
          label="Active Members"
          value={stats?.active_members ?? 0}
          sub="Valid membership"
        />
        <StatCard
          icon={TrendingUp}
          label="New Signups"
          value={stats?.new_signups_7d ?? 0}
          sub="Last 7 days"
        />
        <StatCard
          icon={Calendar}
          label="Events This Month"
          value={stats?.events_this_month ?? 0}
          sub={`${stats?.upcoming_events_count ?? 0} upcoming`}
        />
        <StatCard
          icon={DollarSign}
          label="Revenue This Month"
          value={`$${(stats?.revenue_this_month ?? 0).toFixed(2)}`}
          sub="From membership payments"
        />
        <StatCard
          icon={Clock}
          label="Total Points Awarded"
          value={(stats?.total_points_awarded ?? 0).toLocaleString()}
          sub="All time"
        />
      </div>

      <div
        className="rounded-xl p-6"
        style={{
          background: 'rgba(255,255,255,.04)',
          border: '1px solid rgba(185,28,28,.22)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-4 font-['Oxanium']">
          Quick Summary
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-white/60">
          <div>
            <span className="text-white font-medium">{stats?.active_members ?? 0}</span> of{' '}
            <span className="text-white font-medium">{stats?.total_users ?? 0}</span> users have active memberships
          </div>
          <div>
            <span className="text-white font-medium">{stats?.new_signups_7d ?? 0}</span> new users joined this week
          </div>
          <div>
            <span className="text-white font-medium">{stats?.upcoming_events_count ?? 0}</span> events scheduled upcoming
          </div>
        </div>
      </div>
    </div>
  );
}
