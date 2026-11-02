import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Newspaper,
  Users,
  Mail,
  Building2,
  Bell,
  UserCheck,
  Search,
  Settings,
  Shield,
  LogOut,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { EntityAvatar } from '../ui/AccessBadge';
import { ComposeMessageModal } from '../messaging/ComposeMessageModal';
import { ReportModal } from '../ui/ReportModal';

export function AppShell({
  children,
  rightSidebar,
}: {
  children: React.ReactNode;
  rightSidebar?: React.ReactNode;
}) {
  const { user, unreadSummary, logout } = useAuth();
  const navigate = useNavigate();

  const totalUnreadMessages = unreadSummary.personalUnread.totalAll;
  const unreadNotifs = unreadSummary.unreadNotificationsCount;

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F7F9FB] text-[#1F2937]">
        <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-[#243B53] text-white">
                <KeyRound className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-[#243B53] leading-none">
                  Mobilikey
                </span>
                <span className="text-[10px] font-medium text-[#64748B]">
                  Earn access. Build connections.
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-3 sm:gap-5">
              <Link
                to="/announcements"
                className="text-xs sm:text-sm font-medium text-[#526579] hover:text-[#243B53]"
              >
                Announcements
              </Link>
              <Link
                to="/search"
                className="text-xs sm:text-sm font-medium text-[#526579] hover:text-[#243B53]"
              >
                Directory
              </Link>
              <Link
                to="/login"
                className="text-xs sm:text-sm font-medium text-[#243B53] hover:underline"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="rounded bg-[#243B53] px-3.5 py-1.5 text-xs sm:text-sm font-medium text-white hover:bg-[#1B2D40]"
              >
                Join Free
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>

        <footer className="border-t border-[#E2E8F0] bg-white py-5 text-xs text-[#64748B]">
          <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-2 px-4 sm:px-6">
            <span>© {new Date().getFullYear()} Mobilikey. Earn access. Build connections.</span>
            <div className="flex items-center gap-4">
              <Link to="/announcements" className="hover:text-[#1F2937]">
                Public Announcements
              </Link>
              <Link to="/search" className="hover:text-[#1F2937]">
                Directory Search
              </Link>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  const navItems = [
    { to: '/feed', label: 'Feed', icon: Newspaper, badge: 0 },
    { to: '/network', label: 'Network', icon: Users, badge: 0 },
    { to: '/messages', label: 'Messages', icon: Mail, badge: totalUnreadMessages },
    { to: '/companies', label: 'Companies', icon: Building2, badge: 0 },
    { to: '/notifications', label: 'Notifications', icon: Bell, badge: unreadNotifs },
    { to: '/profile', label: 'Profile', icon: UserCheck, badge: 0 },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FB] text-[#1F2937] pb-16 lg:pb-0">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link to="/feed" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-[#243B53] text-white">
                <KeyRound className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-[#243B53] leading-none">
                  Mobilikey
                </span>
                <span className="text-[10px] font-medium text-[#64748B] hidden sm:inline">
                  Earn access. Build connections.
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/search"
              className="inline-flex items-center gap-1.5 rounded border border-[#E2E8F0] bg-[#F7F9FB] px-3 py-1.5 text-xs font-medium text-[#526579] hover:border-[#CBD5E1] hover:text-[#1F2937]"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search Network</span>
            </Link>

            {user.systemRole === 'admin' && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1 rounded border border-[#243B53]/30 bg-[#243B53]/8 px-2.5 py-1.5 text-xs font-medium text-[#243B53] hover:bg-[#243B53]/15"
              >
                <Shield className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}

            <Link
              to="/settings"
              title="Settings & Privacy"
              className="rounded p-1.5 text-[#526579] hover:bg-[#F7F9FB] hover:text-[#1F2937]"
            >
              <Settings className="h-4 w-4" />
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              title="Sign Out"
              className="rounded p-1.5 text-[#526579] hover:bg-[#F7F9FB] hover:text-[#1F2937]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-5 sm:px-6">
        {/* Desktop Left Navigation Sidebar */}
        <aside className="hidden lg:flex w-56 shrink-0 flex-col gap-4">
          <div className="rounded-md border border-[#E2E8F0] bg-white p-4">
            <div className="flex items-center gap-3">
              <EntityAvatar name={user.name} avatarUrl={user.avatarUrl} size="md" />
              <div className="min-w-0">
                <Link
                  to={`/p/${user.slug}`}
                  className="block truncate text-sm font-semibold text-[#1F2937] hover:text-[#243B53]"
                >
                  {user.name}
                </Link>
                <p className="truncate text-xs text-[#64748B]">
                  {user.headline || user.position || 'Professional Member'}
                </p>
              </div>
            </div>
            {user.companyName && (
              <p className="mt-2.5 truncate border-t border-[#E2E8F0] pt-2 text-xs text-[#526579]">
                {user.companyName}
              </p>
            )}
          </div>

          <nav className="rounded-md border border-[#E2E8F0] bg-white p-2 space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center justify-between rounded px-3 py-2 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[#243B53] text-white'
                        : 'text-[#526579] hover:bg-[#F7F9FB] hover:text-[#1F2937]'
                    }`
                  }
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </span>
                  {item.badge > 0 && (
                    <span className="rounded-full bg-[#287D7D] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {user.managedCompanies.length > 0 && (
            <div className="rounded-md border border-[#E2E8F0] bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                  Managed Companies
                </span>
              </div>
              <div className="space-y-1.5">
                {user.managedCompanies.map((mc) => (
                  <div
                    key={mc.id}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-[#F7F9FB]"
                  >
                    <Link
                      to={`/c/${mc.slug}`}
                      className="truncate text-xs font-medium text-[#1F2937] hover:text-[#243B53]"
                    >
                      {mc.name}
                    </Link>
                    {(mc.role === 'owner' || mc.role === 'admin') && (
                      <Link
                        to={`/messages?inboxType=company&inboxId=${mc.id}`}
                        className="shrink-0 rounded border border-[#E2E8F0] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#287D7D] hover:border-[#287D7D]"
                      >
                        Inbox
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="min-w-0 flex-1">{children}</main>

        {/* Optional Desktop Right Sidebar */}
        {rightSidebar && (
          <aside className="hidden xl:block w-72 shrink-0">{rightSidebar}</aside>
        )}
      </div>

      {/* Mobile Compact Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex lg:hidden items-center justify-around border-t border-[#E2E8F0] bg-white py-1.5 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium ${
                  isActive ? 'text-[#243B53] font-semibold' : 'text-[#64748B]'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
              {item.badge > 0 && (
                <span className="absolute top-0.5 right-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[#287D7D] px-1 text-[9px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <ComposeMessageModal />
      <ReportModal />
    </div>
  );
}

