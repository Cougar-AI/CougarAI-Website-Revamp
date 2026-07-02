import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getStoredUser } from '@/lib/auth';
import AdminShell, { type AdminTab } from '@/components/admin/AdminShell';
import AdminOverviewTab from '@/components/admin/AdminOverviewTab';
import AdminUsersTab from '@/components/admin/AdminUsersTab';
import AdminEventsTab from '@/components/admin/AdminEventsTab';
import AdminOfficersTab from '@/components/admin/AdminOfficersTab';
import AdminEventTypesTab from '@/components/admin/AdminEventTypesTab';
import AdminSponsorsTab from '@/components/admin/AdminSponsorsTab';
import AdminPartnersTab from '@/components/admin/AdminPartnersTab';
import AdminMemberDirectoryTab from '@/components/admin/AdminMemberDirectoryTab';
import AdminEventStatsTab from '@/components/admin/AdminEventStatsTab';
import AdminPointsTab from '@/components/admin/AdminPointsTab';
import AdminProgressTab from '@/components/admin/AdminProgressTab';
import AdminCheckInTab from '@/components/admin/AdminCheckInTab';
import AdminReceiptsTab from '@/components/admin/AdminReceiptsTab';
import AdminNotificationsTab from '@/components/admin/AdminNotificationsTab';
import AdminBulkEmailTab from '@/components/admin/AdminBulkEmailTab';
import AdminSlideshowTab from '@/components/admin/AdminSlideshowTab';

const ADMIN_TABS: AdminTab[] = ['overview', 'users', 'officers', 'sponsors', 'partners', 'event-types', 'receipts', 'notifications', 'bulk-email', 'slideshow'];
const OFFICER_TABS: AdminTab[] = ['events', 'event-stats', 'points', 'members', 'progress', 'checkin'];
const ALL_VALID_TABS: AdminTab[] = [...ADMIN_TABS, ...OFFICER_TABS];

export default function AdminDashboard() {
  const user = getStoredUser();
  const isAdmin = user?.role === 'admin';

  const defaultTab: AdminTab = isAdmin ? 'overview' : 'events';

  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as AdminTab | null;

  // Officers can only access officer tabs; validate the URL param against role
  const resolveTab = (t: AdminTab | null): AdminTab => {
    if (!t || !ALL_VALID_TABS.includes(t)) return defaultTab;
    if (!isAdmin && ADMIN_TABS.includes(t)) return defaultTab;
    return t;
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(() => resolveTab(rawTab));

  useEffect(() => {
    setSearchParams({ tab: activeTab }, { replace: true });
  }, [activeTab]);

  function handleTabChange(tab: AdminTab) {
    // Guard: officers cannot navigate to admin tabs
    if (!isAdmin && ADMIN_TABS.includes(tab)) return;
    setActiveTab(tab);
  }

  return (
    <AdminShell activeTab={activeTab} onTabChange={handleTabChange} userRole={user?.role}>
      {/* Admin tabs */}
      {activeTab === 'overview'    && <AdminOverviewTab />}
      {activeTab === 'users'       && <AdminUsersTab />}
      {activeTab === 'officers'    && <AdminOfficersTab />}
      {activeTab === 'sponsors'    && <AdminSponsorsTab />}
      {activeTab === 'partners'    && <AdminPartnersTab />}
      {activeTab === 'event-types'   && <AdminEventTypesTab />}
      {activeTab === 'receipts'      && <AdminReceiptsTab />}
      {activeTab === 'notifications' && <AdminNotificationsTab />}
      {activeTab === 'bulk-email'    && <AdminBulkEmailTab />}
      {activeTab === 'slideshow'     && <AdminSlideshowTab />}

      {/* Officer tabs */}
      {activeTab === 'events'      && <AdminEventsTab />}
      {activeTab === 'event-stats' && <AdminEventStatsTab />}
      {activeTab === 'points'      && <AdminPointsTab />}
      {activeTab === 'members'     && <AdminMemberDirectoryTab />}
      {activeTab === 'progress'    && <AdminProgressTab />}
      {activeTab === 'checkin'     && <AdminCheckInTab />}
    </AdminShell>
  );
}
