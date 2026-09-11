import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { api } from '../services/api';
import { UserProfile, Permission, PermissionCode, RoleId, UserLevel } from '../types';
import { 
  ShieldAlert, ShieldCheck, Check, AlertTriangle, 
  Users, Lock
} from 'lucide-react';

export const Permissions: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { success, error } = useToast();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserPermissions, setSelectedUserPermissions] = useState<PermissionCode[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profileRole, setProfileRole] = useState<RoleId>('STANDARD_USER');
  const [profileLevel, setProfileLevel] = useState<UserLevel>(0);

  const selectUserData = (target: UserProfile) => {
    setSelectedUserPermissions([...target.permissions]);
    setProfileName(target.full_name);
    setProfileUsername(target.username);
    setProfileRole(target.role_id);
    setProfileLevel(target.level);
  };

  const loadData = useCallback(async () => {
    try {
      const [uList, pList] = await Promise.all([
        api.getUsers(),
        api.getPermissions(),
      ]);
      setUsers(uList);
      setAllPermissions(pList);

      // Default selected user to another user (not oneself, e.g. student or researcher)
      const otherUser = uList.find(u => u.id !== user?.id) || uList[0];
      if (otherUser) {
        setSelectedUserId(otherUser.id);
        selectUserData(otherUser);
      }
    } catch (err) {
      console.error('Failed to load permissions:', err);
      error('Failed to load user permissions.', 'Data Error');
    } finally {
    }
  }, [user, error]);

  useEffect(() => {
    // Data loading is the external synchronization this effect owns.
    // oxlint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const handleSelectUser = (id: string) => {
    setSelectedUserId(id);
    const target = users.find(u => u.id === id);
    if (target) selectUserData(target);
  };

  const handleSaveProfile = async () => {
    if (!user || !selectedUserId) return;
    setIsSaving(true);
    const result = await api.updateUserProfile(user, selectedUserId, {
      full_name: profileName,
      username: profileUsername,
      role: profileRole,
      level: profileLevel,
    });
    setIsSaving(false);
    if (result.success) {
      success('User profile updated.', 'Profile saved');
      await loadData();
      await refreshUser();
    } else {
      error(result.error || 'Could not update profile.', 'Profile update failed');
    }
  };

  const handleTogglePermission = (permId: PermissionCode) => {
    setSelectedUserPermissions((prev) => 
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
  };

  // FR7 CRITICAL SECURITY RULE:
  // "An administrator MUST NOT assign permissions greater than their own permissions."
  const handleSavePermissions = async () => {
    if (!user || !selectedUserId) return;

    // Check for excessive permissions (permissions that the acting user DOES NOT possess)
    const unauthorizedPermissions = selectedUserPermissions.filter(
      (p) => !user.permissions.includes(p)
    );

    if (unauthorizedPermissions.length > 0) {
      // Reject operation
      error(
        `You cannot assign permissions greater than your own. Unauthorized permissions: ${unauthorizedPermissions.join(', ')}`,
        'Security Violation (FR7)'
      );
      return;
    }

    setIsSaving(true);
    const result = await api.delegatePermissions(user, selectedUserId, selectedUserPermissions);
    setIsSaving(false);

    if (result.success) {
      success('Permissions updated successfully.', 'Delegation Complete');
      // Refresh user list and current user
      await loadData();
      await refreshUser();
    } else {
      error(result.error || 'Failed to update permissions.', 'Delegation Rejected');
    }
  };

  const selectedTargetUser = users.find(u => u.id === selectedUserId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <ShieldAlert className="w-7 h-7 text-brand-600" />
          <span>Permissions</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage access without exceeding your own permissions.
        </p>
      </div>

      {/* Critical Security Rule Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5 shadow-sm">
        <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>Access rule</span>
        </div>
        <p className="leading-relaxed">
          You can only grant permissions that you already have.
        </p>
        <p className="text-[11px] text-amber-800 font-mono">
          You have <strong>{user?.permissions.length} permissions</strong>.
        </p>
      </div>

      {/* Main Grid: User Selection on Left, Permission Matrix on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Target User Picker */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-600" />
            <span>Select a user</span>
          </h2>
          <p className="text-xs text-slate-500">
            Choose an account to update.
          </p>

          <div className="space-y-2 pt-2">
            {users.map((u) => {
              const isSelected = u.id === selectedUserId;
              const isSelf = u.id === user?.id;

              return (
                <button
                  key={u.id}
                  onClick={() => handleSelectUser(u.id)}
                  type="button"
                  className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-brand-50 border-brand-500 shadow-sm ring-1 ring-brand-500'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {u.full_name} {isSelf && '(You)'}
                    </div>
                    <div className="text-[11px] text-slate-500">{u.role_id} • Level {u.level}</div>
                  </div>
                  <span className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-semibold">
                    {u.permissions.length} perms
                  </span>
                </button>
              );
            })}
          </div>

          {selectedTargetUser && (
            <div className="pt-4 mt-4 border-t border-slate-200 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Profile</h3>
              <input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Full name" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
              <input value={profileUsername} onChange={e => setProfileUsername(e.target.value)} placeholder="Username" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
              <div className="grid grid-cols-2 gap-2">
                <select value={profileRole} onChange={e => setProfileRole(e.target.value as RoleId)} className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <option value="STANDARD_USER">User</option>
                  <option value="RESEARCH_STAFF">Research staff</option>
                  <option value="DEPARTMENT_ADMIN">Department admin</option>
                  <option value="FACULTY_ADMIN">Faculty admin</option>
                  <option value="IT_GROUP_MEMBER">Inventory admin</option>
                  <option value="UNIVERSITY_ADMIN">University admin</option>
                </select>
                <select value={profileLevel} onChange={e => setProfileLevel(Number(e.target.value) as UserLevel)} className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  {[0, 1, 2, 3].map(level => <option key={level} value={level}>Level {level}</option>)}
                </select>
              </div>
              <button type="button" onClick={handleSaveProfile} disabled={isSaving} className="w-full px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                Save profile
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Permission Delegation Matrix */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>Permissions for {selectedTargetUser?.full_name}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select the access this user needs.
              </p>
            </div>

            <button
              onClick={handleSavePermissions}
              disabled={isSaving}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md shadow-brand-600/20 transition flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save permissions'}</span>
            </button>
          </div>

          {/* Permissions Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allPermissions.map((perm) => {
              const targetHas = selectedUserPermissions.includes(perm.id);
              const callerPossesses = user?.permissions.includes(perm.id) || false;
              const willViolateRule = targetHas && !callerPossesses;

              return (
                <div
                  key={perm.id}
                  onClick={() => handleTogglePermission(perm.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start justify-between gap-3 ${
                    willViolateRule
                      ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-400'
                      : targetHas
                      ? 'bg-emerald-50/70 border-emerald-300 shadow-sm'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{perm.name}</span>
                      {!callerPossesses && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold border border-amber-200 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Beyond your privilege</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">{perm.description}</p>
                    <span className="text-[10px] font-mono text-slate-400 block">{perm.id}</span>
                  </div>

                  <div className="shrink-0 mt-0.5">
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                      targetHas 
                        ? willViolateRule ? 'bg-rose-600 border-rose-600 text-white' : 'bg-emerald-600 border-emerald-600 text-white' 
                        : 'border-slate-300 bg-white'
                    }`}>
                      {targetHas && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Warning indicator if user selected an excessive permission */}
          {selectedUserPermissions.some(p => !user?.permissions.includes(p)) && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                <strong>Warning:</strong> You have selected permissions not in your own possession. 
                Attempting to save will be rejected under the FR7 non-escalation rule.
              </span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
