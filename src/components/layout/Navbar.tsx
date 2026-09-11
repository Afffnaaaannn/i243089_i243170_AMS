import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { api } from '../../services/api';
import { 
  Boxes, LayoutDashboard, ArrowRightLeft, FileText, CheckSquare, 
  MapPin, ShieldAlert, LogOut, Menu, X
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);

  // Poll/fetch pending approvals for current user's scope
  useEffect(() => {
    if (!user) return;
    const checkApprovals = async () => {
      try {
        const { requests, transfers } = await api.getAuthorizedPendingRequests(user);
        setPendingApprovalCount(requests.length + transfers.length);
      } catch (err) {
        console.error('Failed to count approvals:', err);
      }
    };
    checkApprovals();
    const interval = setInterval(checkApprovals, 4000);
    return () => clearInterval(interval);
  }, [user, location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Inventory', path: '/inventory', icon: Boxes },
    { name: 'Transfers', path: '/transfers', icon: ArrowRightLeft },
    { name: 'Requests', path: '/requests', icon: FileText },
    { 
      name: 'Approvals', 
      path: '/approvals', 
      icon: CheckSquare,
      badge: pendingApprovalCount > 0 ? pendingApprovalCount : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
    { name: 'Locations', path: '/locations', icon: MapPin },
    { 
      name: 'Permissions', 
      path: '/permissions', 
      icon: ShieldAlert,
      show: user?.level ? user.level >= 1 : false,
    },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-8 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-slate-900 block leading-tight">
                  UniAsset <span className="text-brand-600">AMS</span>
                </span>
                <span className="text-[10px] text-slate-500 block leading-none font-medium">
                  Asset management
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                if (item.show === false) return null;
                const isActive = location.pathname === item.path;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                    {item.badge !== undefined && (
                      <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: Active Profile info and Logout */}
          <div className="hidden md:flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-900 leading-tight">
                    {user.full_name}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-end gap-1">
                    <span className="font-medium text-brand-600">{user.role_id.replace(/_/g, ' ')}</span>
                    <span>•</span>
                    <span>L{user.level}</span>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs shadow-inner">
                  {user.username.slice(0, 2).toUpperCase()}
                </div>

                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  title="Log out"
                  aria-label="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1">
          {user && (
            <div className="p-3 mb-2 bg-slate-50 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">{user.full_name}</div>
                <div className="text-xs text-slate-500">{user.role_id} (Level {user.level})</div>
              </div>
            </div>
          )}

          {navItems.map((item) => {
            if (item.show === false) return null;
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-base font-medium ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-rose-600 hover:bg-rose-50 font-medium"
            >
              <LogOut className="w-5 h-5" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};
