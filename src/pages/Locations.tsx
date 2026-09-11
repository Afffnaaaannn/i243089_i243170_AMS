import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { api } from '../services/api';
import { Location, Department, RequestItem } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { 
  MapPin, Plus, ShieldCheck, Building2, DoorOpen, FileCheck, Lock, Pencil, Trash2
} from 'lucide-react';

export const Locations: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const { success, error } = useToast();

  const [locations, setLocations] = useState<Location[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);

  // Create Location Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [building, setBuilding] = useState('');
  const [room, setRoom] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [selectedExceptionId, setSelectedExceptionId] = useState('');
  const [formValidationErrors, setFormValidationErrors] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [l, d, r] = await Promise.all([
        api.getLocations(),
        api.getDepartments(),
        api.getRequests(),
      ]);
      setLocations(l);
      setDepartments(d);
      setRequests(r);
    } catch (err) {
      console.error('Failed to load locations:', err);
      error('Failed to load locations.', 'Data Error');
    } finally {
    }
  }, [error]);

  useEffect(() => {
    // Data loading is the external synchronization this effect owns.
    // oxlint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  // Filter exception requests for location creation:
  // Must be form_type === 'EXCEPTION'
  const exceptionRequests = requests.filter(r => r.form_type === 'EXCEPTION');
  const approvedExceptions = exceptionRequests.filter(
    r => r.status === 'APPROVED' || r.status === 'WAITING_FOR_EXECUTION'
  );

  const isITAuthorized = user?.role_id === 'IT_GROUP_MEMBER' || hasPermission('create_locations');

  const handleOpenCreate = () => {
    if (!user) return;

    // Strict UI Authorization Check (FR3)
    if (!isITAuthorized) {
      error(
        'You are not authorized to create a location. Only authorized IT group members can perform this operation.',
        'Authorization Denied'
      );
      return;
    }

    setFormValidationErrors([]);
    setEditingLocationId(null);
    setName('');
    setBuilding('');
    setRoom('');
    setDepartmentId(departments[0]?.id || '');
    // Pre-select first approved exception if available
    setSelectedExceptionId(approvedExceptions[0]?.id || '');
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (location: Location) => {
    if (!isITAuthorized) {
      error('You do not have permission to edit locations.', 'Access denied');
      return;
    }
    setFormValidationErrors([]);
    setEditingLocationId(location.id);
    setName(location.name);
    setBuilding(location.building);
    setRoom(location.room);
    setDepartmentId(location.department_id);
    setSelectedExceptionId(location.exception_request_id || '');
    setIsCreateModalOpen(true);
  };

  const handleDelete = async (location: Location) => {
    if (!user || !window.confirm(`Delete ${location.name}?`)) return;
    const result = await api.deleteLocation(user, location.id);
    if (result.success) {
      success('Location deleted.', 'Location removed');
      loadData();
    } else {
      error(result.error || 'Could not delete location.', 'Delete failed');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setFormValidationErrors([]);
    const errors: string[] = [];

    if (!name.trim()) errors.push('Location Name is required.');
    if (!building.trim()) errors.push('Building name is required.');
    if (!room.trim()) errors.push('Room number is required.');
    if (!departmentId) errors.push('Department association is required.');
    if (!selectedExceptionId) errors.push('An approved/valid exception request is required.');

    if (errors.length > 0) {
      setFormValidationErrors(errors);
      error('Please complete all required fields.', 'Validation Error');
      return;
    }

    const result = editingLocationId
      ? await api.updateLocation(user, editingLocationId, {
          name: name.trim(),
          building: building.trim(),
          room: room.trim(),
          department_id: departmentId,
          is_active: true,
        })
      : await api.createLocation(user, {
          name: name.trim(),
          building: building.trim(),
          room: room.trim(),
          department_id: departmentId,
          exception_request_id: selectedExceptionId,
        });

    if (result.success) {
      success(editingLocationId ? 'Location updated.' : 'Location created successfully.', editingLocationId ? 'Location updated' : 'Space Provisioned');
      setIsCreateModalOpen(false);
      loadData();
    } else {
      error(result.error || 'Failed to create location.', 'Operation Denied');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <MapPin className="w-7 h-7 text-brand-600" />
            <span>Campus Locations & Spaces</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage campus locations.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition shadow-md ${
            isITAuthorized
              ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/20'
              : 'bg-slate-200 text-slate-500 hover:bg-slate-300 cursor-not-allowed'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Provision New Location</span>
        </button>
      </div>

      {/* Business Rule Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
        <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-sm">Location access</p>
          <p className="leading-relaxed">
            Only authorized IT staff can create locations with an approved exception.
          </p>
          <p className="text-[11px] text-amber-800">
            Status: <strong>{isITAuthorized ? 'Authorized' : 'View only'}</strong>.
          </p>
        </div>
      </div>

      {/* Locations List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((loc) => {
          const dept = departments.find(d => d.id === loc.department_id);

          return (
            <div
              key={loc.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="p-2 rounded-xl bg-brand-50 text-brand-600">
                    <Building2 className="w-5 h-5" />
                  </span>
                  <Badge variant={loc.is_active ? 'success' : 'default'} size="sm">
                    {loc.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>
                </div>

                <h3 className="text-base font-bold text-slate-900 leading-snug">{loc.name}</h3>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                  <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
                  <span>{loc.building} — {loc.room}</span>
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">{dept?.name || 'Central'}</span>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-mono">
                    {dept?.code || 'UNIV'}
                  </span>
                  {isITAuthorized && (
                    <>
                      <button type="button" onClick={() => handleOpenEdit(loc)} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg" title="Edit location" aria-label={`Edit ${loc.name}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDelete(loc)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Delete location" aria-label={`Delete ${loc.name}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE LOCATION MODAL (Protected FR3 Workflow) */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editingLocationId ? 'Edit location' : 'Create location'}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs sm:text-sm">
          {formValidationErrors.length > 0 && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <ul className="list-disc pl-4 space-y-0.5">
                {formValidationErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

          {!editingLocationId && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Operator Verified: <strong>{user?.full_name}</strong> (IT Role / Level {user?.level})
            </span>
          </div>}

          {/* Exception Request Link Selector (MANDATORY RULE) */}
          {!editingLocationId && <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <label className="block font-bold text-slate-800 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-brand-600" />
              <span>Associated Approved Exception Request <span className="text-rose-500">*</span></span>
            </label>
            <p className="text-[11px] text-slate-500">
              Select an approved exception request that justifies this new space provision:
            </p>

            <select
              value={selectedExceptionId}
              onChange={(e) => setSelectedExceptionId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">-- Select an Exception Request --</option>
              {exceptionRequests.map((req) => (
                <option 
                  key={req.id} 
                  value={req.id}
                  className={req.status === 'APPROVED' ? 'text-emerald-700 font-bold' : 'text-slate-500'}
                >
                  [{req.status}] {req.request_number} — {req.purpose}
                </option>
              ))}
            </select>

            {selectedExceptionId && (
              <div className="mt-2 text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                {(() => {
                  const req = exceptionRequests.find(r => r.id === selectedExceptionId);
                  if (!req) return null;
                  const isApproved = req.status === 'APPROVED' || req.status === 'WAITING_FOR_EXECUTION';
                  return (
                    <div>
                      <div><strong>Justification:</strong> {req.special_justification || req.purpose}</div>
                      <div className="mt-1 flex items-center gap-1">
                        <span>Status:</span>
                        <span className={`font-semibold ${isApproved ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {req.status} {isApproved ? '✓ (Valid)' : '✗ (Unapproved - will be rejected)'}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Location / Room Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Autonomous Robotics Arena"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Building <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder="e.g. Turing Engineering Hall"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Room Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g. Room R-204"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Department Assigned <span className="text-rose-500">*</span>
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow-md shadow-brand-600/20"
            >
              {editingLocationId ? 'Save changes' : 'Create location'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
