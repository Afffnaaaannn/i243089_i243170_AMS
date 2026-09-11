import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { api } from '../services/api';
import { Asset, RequestItem, TransferItem } from '../types';
import { 
  Boxes, FileText, CheckSquare, ArrowRightLeft, Shield, MapPin, 
  ArrowUpRight, AlertCircle
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [authorizedPendingCount, setAuthorizedPendingCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [aList, rList, tList] = await Promise.all([
          api.getAssets(),
          api.getRequests(),
          api.getTransfers(),
        ]);
        setAssets(aList);
        setRequests(rList);
        setTransfers(tList);

        if (user) {
          const { requests: authReqs, transfers: authTrfs } = await api.getAuthorizedPendingRequests(user);
          setAuthorizedPendingCount(authReqs.length + authTrfs.length);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
      }
    };

    fetchData();
  }, [user]);

  if (!user) return null;

  const myRequests = requests.filter(r => r.user_id === user.id);
  const totalAssets = assets.length;
  const inUseAssets = assets.filter(a => a.status === 'IN_USE').length;
  const availableAssets = assets.filter(a => a.status === 'AVAILABLE').length;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-900 via-brand-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 text-brand-200 border border-brand-400/30 text-xs font-semibold mb-3">
            <Shield className="w-3.5 h-3.5" />
            <span>Role: {user.role_id.replace(/_/g, ' ')} • Level {user.level}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Welcome, {user.full_name}
          </h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Manage university assets, locations, requests, and transfers in one place.
          </p>
          
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <Link
              to="/inventory"
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-white rounded-xl text-sm font-semibold transition shadow-md shadow-brand-500/20"
            >
              <Boxes className="w-4 h-4" />
              <span>Explore Inventory</span>
            </Link>
            <Link
              to="/requests"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold backdrop-blur-sm transition border border-white/10"
            >
              <FileText className="w-4 h-4" />
              <span>Submit Request</span>
            </Link>
          </div>
        </div>

        {/* Decorative background geometry */}
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Assets</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalAssets}</h3>
            <p className="text-xs text-slate-500 mt-1">
              <span className="text-emerald-600 font-semibold">{availableAssets} Available</span> • {inUseAssets} In Use
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">My Requests</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{myRequests.length}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {myRequests.filter(r => r.status === 'PENDING').length} Pending review
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Approvals</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{authorizedPendingCount}</h3>
            <p className="text-xs text-slate-500 mt-1">Within your authorization scope</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <CheckSquare className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Asset Transfers</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{transfers.length}</h3>
            <p className="text-xs text-slate-500 mt-1">Across departments & faculties</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: Pending Approvals Alert + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: Authorized Approvals Queue or Quick Actions */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-brand-600" />
                <h2 className="text-base font-bold text-slate-900">Action Queue</h2>
              </div>
              <Link to="/approvals" className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                <span>View all</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {authorizedPendingCount === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <CheckSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">All caught up!</p>
                <p className="text-xs text-slate-500 mt-1">
                  Nothing needs your attention right now.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 flex-1">
                    <span className="font-semibold">Action Required:</span> You have{' '}
                    <strong>{authorizedPendingCount}</strong> pending item(s) requiring your administrative decision.
                  </div>
                  <Link
                    to="/approvals"
                    className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                  >
                    Review Now
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-4">Functional Requirements Quick Navigation</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link to="/inventory" className="p-4 rounded-xl border border-slate-100 hover:border-brand-300 bg-slate-50/60 hover:bg-brand-50/40 transition group">
                <div className="flex items-center gap-2.5 font-semibold text-slate-900 group-hover:text-brand-700 text-sm">
                  <Boxes className="w-4 h-4 text-brand-600" />
                  <span>FR2: Manage Assets</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Add, edit, scope checks, immutable IDs.</p>
              </Link>

              <Link to="/locations" className="p-4 rounded-xl border border-slate-100 hover:border-brand-300 bg-slate-50/60 hover:bg-brand-50/40 transition group">
                <div className="flex items-center gap-2.5 font-semibold text-slate-900 group-hover:text-brand-700 text-sm">
                  <MapPin className="w-4 h-4 text-brand-600" />
                  <span>FR3: Create Location</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">IT role + approved exception workflow.</p>
              </Link>

              <Link to="/transfers" className="p-4 rounded-xl border border-slate-100 hover:border-brand-300 bg-slate-50/60 hover:bg-brand-50/40 transition group">
                <div className="flex items-center gap-2.5 font-semibold text-slate-900 group-hover:text-brand-700 text-sm">
                  <ArrowRightLeft className="w-4 h-4 text-brand-600" />
                  <span>FR4: Transfer Assets</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">4 distinct cases (Dept, Faculty, Univ).</p>
              </Link>

              <Link to="/requests" className="p-4 rounded-xl border border-slate-100 hover:border-brand-300 bg-slate-50/60 hover:bg-brand-50/40 transition group">
                <div className="flex items-center gap-2.5 font-semibold text-slate-900 group-hover:text-brand-700 text-sm">
                  <FileText className="w-4 h-4 text-brand-600" />
                  <span>FR5: Borrow / Reserve</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Basic, Advanced, and Exception forms.</p>
              </Link>
            </div>
          </div>
        </div>

        {/* Right column: Current User Organizational Profile */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-4">Organizational Scope & Privileges</h2>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                <span className="text-slate-500">University Domain:</span>
                <span className="font-semibold text-slate-800">Central State University (CSU)</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                <span className="text-slate-500">Faculty Scope:</span>
                <span className="font-semibold text-slate-800">{user.faculty_id || 'Campus-wide / None'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                <span className="text-slate-500">Department Scope:</span>
                <span className="font-semibold text-slate-800">{user.department_id || 'All / Cross-Faculty'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                <span className="text-slate-500">Administrative Level:</span>
                <span className="font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                  Level {user.level}
                </span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Granted Permissions</p>
              <div className="flex flex-wrap gap-1.5">
                {user.permissions.map((perm) => (
                  <span key={perm} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
