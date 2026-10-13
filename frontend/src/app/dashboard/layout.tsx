'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';
import { useRequireAuth } from '@/hooks/useAuth';
import { cn, initials } from '@/lib/utils';
import { api } from '@/lib/api';
import {
  LayoutDashboard, MessageSquare, Users, BarChart3, Settings,
  UserCog, Bot, Search, Bell, LogOut, Moon, Sun, Menu,
  ChevronDown, CheckSquare,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/inbox', label: 'Shared Inbox', icon: MessageSquare },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: MessageSquare },
  { href: '/dashboard/leads', label: 'Leads / CRM', icon: Users },
  { href: '/dashboard/lead-tracker', label: 'Master Dashboard', icon: CheckSquare, allowedEmails: ['harshbha30@gmail.com'] },
  { href: '/dashboard/scraper', label: 'Lead Scraper', icon: Search },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/ai-assistant', label: 'AI Assistant', icon: Bot },
  { href: '/dashboard/team', label: 'Team', icon: UserCog, roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/dashboard/admin', label: 'Super Admin', icon: UserCog, roles: ['SUPER_ADMIN'] },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, organization, logout } = useAuthStore();
  const { isAuthenticated } = useRequireAuth();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const currentPath = pathname || '';

  const { data: inboxSummary } = useQuery({
    queryKey: ['whatsapp-chats-summary'],
    queryFn: async () => {
      const { data } = await api.get('/whatsapp/chats/summary');
      return data.data;
    },
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });

  useEffect(() => setMounted(true), []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        {sidebarOpen && (
          <p className="font-bold text-sm text-foreground truncate text-center">
            {organization?.name || 'WACrm Pro'}
          </p>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.filter((item: any) => {
          if (item.allowedEmails) {
            const userEmail = (user?.email || '').toLowerCase();
            return item.allowedEmails.some((e: string) => e.toLowerCase() === userEmail) || user?.role === 'SUPER_ADMIN';
          }
          return !item.roles || item.roles.includes(user?.role);
        }).map((item) => {
          const active = currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-primary/10 text-primary dark:bg-primary/20'
                  : 'text-sidebar-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <item.icon className={cn('w-5 h-5 flex-shrink-0', active ? 'text-primary' : '')} />
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {active && sidebarOpen && (
                <motion.div
                  layoutId="active-indicator"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
                />
              )}
              {item.href === '/dashboard/inbox' && sidebarOpen && Number(inboxSummary?.unreadMessages) > 0 && !active && (
                <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-green-600 text-white text-[11px] flex items-center justify-center">
                  {inboxSummary.unreadMessages}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-2">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-11 h-11 rounded-xl gradient-brand flex items-center justify-center flex-shrink-0 overflow-hidden">
            {organization?.logo ? (
              <img src={organization.logo} alt={organization.name || 'Organization'} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-white">{initials(organization?.name || 'W')}</span>
            )}
          </div>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="overflow-hidden">
                <p className="font-bold text-sm text-foreground truncate max-w-[130px]">{organization?.name || 'WACrm Pro'}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{organization?.plan?.toLowerCase()} plan</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-accent w-full transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 flex-shrink-0" /> : <Moon className="w-4 h-4 flex-shrink-0" />}
            {sidebarOpen && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
          </button>
        )}

        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-500/10 w-full transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {sidebarOpen && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: sidebarOpen ? 240 : 64 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border flex-shrink-0 relative z-20"
      >
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors z-10 shadow-sm"
        >
          {sidebarOpen ? <ChevronDown className="w-3 h-3 rotate-90" /> : <ChevronDown className="w-3 h-3 -rotate-90" />}
        </button>
        <SidebarContent />
      </motion.aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border z-40 lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-4 gap-4 flex-shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          {/* Topbar actions */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setNotificationOpen(open => !open)}
                className="relative p-2 rounded-lg hover:bg-accent transition-colors"
                aria-label="Open notifications"
                aria-expanded={notificationOpen}
              >
                <Bell className="w-4 h-4 text-muted-foreground" />
                {Number(inboxSummary?.unreadMessages) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center">
                    {inboxSummary.unreadMessages}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {notificationOpen && (
                  <>
                    <motion.button
                      type="button"
                      aria-label="Close notifications"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setNotificationOpen(false)}
                      className="fixed inset-0 z-30 cursor-default"
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      className="absolute right-0 top-11 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-card shadow-xl overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-border">
                        <p className="text-sm font-semibold">Notifications</p>
                        <p className="text-xs text-muted-foreground">Recent account activity</p>
                      </div>
                      <div className="max-h-80 overflow-y-auto scrollbar-thin">
                        {[
                          { title: 'Scraper jobs ready', body: 'Completed jobs can be imported from Lead Scraper.' },
                          { title: 'Team invites enabled', body: 'New members receive login details by email.' },
                          { title: 'Password reset available', body: 'Users can request a reset link from sign in.' },
                        ].map((item) => (
                          <div key={item.title} className="px-4 py-3 border-b border-border/60 last:border-b-0 hover:bg-accent/50">
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.body}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <div className="w-7 h-7 rounded-full gradient-brand flex items-center justify-center text-white text-xs font-bold">
                {initials(user?.name || 'U')}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin p-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            key={pathname}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
