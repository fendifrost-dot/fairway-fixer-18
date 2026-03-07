import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Scale,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/clients', icon: Users, label: 'Clients' },
];

const bottomNavItems = [
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function AppSidebar() {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Mobile: overlay drawer
  if (isMobile) {
    return (
      <>
        {/* Mobile hamburger button */}
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-3 left-3 z-50 p-2 rounded-md bg-card border border-border shadow-sm"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>

        {/* Backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Drawer */}
        <aside
          className={cn(
            "fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-[60] transition-transform duration-300",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="h-14 flex items-center justify-between border-b border-sidebar-border px-4">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-sidebar-primary" />
              <span className="font-semibold text-sidebar-foreground text-sm">CreditFlow</span>
            </div>
            <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60">
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink key={item.path} to={item.path} className={cn("nav-item", isActive && "nav-item-active")}>
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border py-3 px-2 space-y-1">
            {bottomNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink key={item.path} to={item.path} className={cn("nav-item", isActive && "nav-item-active")}>
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </aside>
      </>
    );
  }

  // Desktop: fixed sidebar
  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 z-50",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn(
        "h-16 flex items-center border-b border-sidebar-border px-4",
        collapsed ? "justify-center" : "justify-between"
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Scale className="h-6 w-6 text-sidebar-primary" />
            <span className="font-semibold text-sidebar-foreground">CreditFlow</span>
          </div>
        )}
        {collapsed && <Scale className="h-6 w-6 text-sidebar-primary" />}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors",
            collapsed && "absolute -right-3 bg-sidebar border border-sidebar-border"
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn("nav-item", isActive && "nav-item-active", collapsed && "justify-center px-2")}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border py-4 px-2 space-y-1">
        {bottomNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn("nav-item", isActive && "nav-item-active", collapsed && "justify-center px-2")}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </div>
    </aside>
  );
}
