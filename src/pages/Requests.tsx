import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { api } from '../services/api';
import { RequestItem, Asset, Location, RequestType, FormType, RequestStatus } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { 
  FileText, Plus, MapPin, Boxes, Lock, Info, Pencil, XCircle
} from 'lucide-react';

export const Requests: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Modal & Form State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<RequestType>('BORROW_ASSET');
  const [formType, setFormType] = useState<FormType>('BASIC');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [specialJustification, setSpecialJustification] = useState('');
  const [formValidationErrors, setFormValidationErrors] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [r, a, l] = await Promise.all([
        api.getRequests(),
        api.getAssets(),
        api.getLocations(),
      ]);
      setRequests(r);
      setAssets(a);
      setLocations(l);
    } catch (err) {
      console.error('Failed to load requests:', err);
      error('Failed to load request records.', 'Data Error');
    } finally {
    }
  }, [error]);

  useEffect(() => {
    // Data loading is the external synchronization this effect owns.
    // oxlint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const handleOpenCreate = () => {
    setFormValidationErrors([]);
    setEditingRequestId(null);
    setRequestType('BORROW_ASSET');
    setFormType('BASIC'); // Default to Basic
    setSelectedAssetId(assets[0]?.id || '');
    setSelectedLocationId(locations[0]?.id || '');
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate(new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10));
    setPurpose('');
    setSpecialJustification('');
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (request: RequestItem) => {
    setEditingRequestId(request.id);
    setFormValidationErrors([]);
    setRequestType(request.request_type);
    setFormType(request.form_type);
    setSelectedAssetId(request.asset_id || '');
    setSelectedLocationId(request.location_id || '');
    setStartDate(request.start_date.slice(0, 10));
    setEndDate(request.end_date.slice(0, 10));
    setPurpose(request.purpose);
    setSpecialJustification(request.special_justification || '');
    setIsCreateModalOpen(true);
  };

  const handleCancelRequest = async (request: RequestItem) => {
    if (!user || !window.confirm(`Cancel request ${request.request_number}?`)) return;
    const result = await api.cancelRequest(user, request.id);
    if (result.success) {
      success('Request cancelled.', 'Request updated');
      loadData();
    } else error(result.error || 'Could not cancel request.', 'Cancel failed');
  };

  // FR5 BUSINESS RULE: Check form type authorization
  const canAccessFormType = (type: FormType): boolean => {
    if (!user) return false;
    if (type === 'BASIC') return true; // Available to all users (Level 0, 1, 2, 3)
    if (type === 'ADVANCED') return user.level >= 1 || user.permissions.includes('create_advanced_requests');
    if (type === 'EXCEPTION') return user.level >= 2 || user.permissions.includes('create_exception_requests');
    return false;
  };

  const handleSelectFormType = (type: FormType) => {
    if (!canAccessFormType(type)) {
      error('You are not authorized to use this request form.', 'Unauthorized Form');
      return;
    }
    setFormType(type);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setFormValidationErrors([]);
    const errors: string[] = [];

    // Check Form Type Authorization
    if (user.level === 0 && formType !== 'BASIC') {
      errors.push('Level 0 users are strictly restricted to the Basic request form.');
      error('You are not authorized to use this request form.', 'Unauthorized Form');
      setFormValidationErrors(errors);
      return;
    }

    if (!purpose.trim()) errors.push('Purpose is required.');
    if (!startDate) errors.push('Start date is required.');
    if (!endDate) errors.push('End date is required.');

    if (requestType === 'BORROW_ASSET' && !selectedAssetId) {
      errors.push('Asset selection is required.');
    }
    if (requestType === 'RESERVE_LOCATION' && !selectedLocationId) {
      errors.push('Location selection is required.');
    }

    if (formType !== 'BASIC' && !specialJustification.trim()) {
      errors.push('Special justification is required for Advanced and Exception request forms.');
    }

    if (errors.length > 0) {
      setFormValidationErrors(errors);
      error('Please complete the required fields.', 'Validation Error');
      return;
    }

    const result = editingRequestId
      ? await api.updateRequest(user, editingRequestId, {
          asset_id: requestType === 'BORROW_ASSET' ? selectedAssetId : null,
          location_id: requestType === 'RESERVE_LOCATION' ? selectedLocationId : null,
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
          purpose: purpose.trim(),
          special_justification: specialJustification.trim() || undefined,
        })
      : await api.createRequest(user, {
          request_type: requestType,
          form_type: formType,
          asset_id: requestType === 'BORROW_ASSET' ? selectedAssetId : undefined,
          location_id: requestType === 'RESERVE_LOCATION' ? selectedLocationId : undefined,
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
          purpose: purpose.trim(),
          special_justification: specialJustification.trim() || undefined,
        });

    if (result.success) {
      success(editingRequestId ? 'Request updated.' : 'Request submitted successfully.', editingRequestId ? 'Request updated' : 'Request submitted');
      setIsCreateModalOpen(false);
      loadData();
    } else {
      error(result.error || 'Failed to submit request.', 'Submission Error');
    }
  };

  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning" size="sm">PENDING</Badge>;
      case 'WAITING_FOR_EXECUTION':
        return <Badge variant="purple" size="sm">WAITING FOR EXECUTION</Badge>;
      case 'APPROVED':
        return <Badge variant="success" size="sm">APPROVED</Badge>;
      case 'REJECTED':
        return <Badge variant="danger" size="sm">REJECTED</Badge>;
      default:
        return <Badge variant="default" size="sm">{status}</Badge>;
    }
  };

  // Filter requests for currently logged-in user or all requests
  const myRequests = requests.filter(r => r.user_id === user?.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-brand-600" />
            <span>Borrow & Reservation Requests</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Submit and track requests.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-brand-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Borrow / Reservation</span>
        </button>
      </div>

      {/* Level Form Access Rule Notice */}
      <div className="p-4 rounded-2xl bg-brand-50 border border-brand-200 text-brand-900 text-xs flex items-start gap-3">
        <Info className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-sm">Request access</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
            <div className="p-2 bg-white rounded-lg border border-brand-100">
              <span className="font-semibold block text-slate-800">1. Basic Form</span>
              <span className="text-[11px] text-slate-500">Accessible by all users (Level 0, 1, 2, 3)</span>
            </div>
            <div className="p-2 bg-white rounded-lg border border-brand-100">
              <span className="font-semibold block text-slate-800">2. Advanced Form</span>
              <span className="text-[11px] text-slate-500">Requires Level 1+ (Senior Staff/Researchers)</span>
            </div>
            <div className="p-2 bg-white rounded-lg border border-brand-100">
              <span className="font-semibold block text-slate-800">3. Exception Form</span>
              <span className="text-[11px] text-slate-500">Requires Level 2+ (Faculty/Admin/Special)</span>
            </div>
          </div>
          <p className="text-[11px] text-brand-800 mt-1">
            Current access: <strong>Level {user?.level}</strong>.
            {user?.level === 0 && ' Basic requests only.'}
          </p>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">My Submitted Requests & Statuses</h2>
          <span className="text-xs text-slate-400">{myRequests.length} Requests</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th scope="col" className="px-5 py-3.5">Request #</th>
                <th scope="col" className="px-5 py-3.5">Type & Form</th>
                <th scope="col" className="px-5 py-3.5">Target Item / Space</th>
                <th scope="col" className="px-5 py-3.5">Duration</th>
                <th scope="col" className="px-5 py-3.5">Workflow Status</th>
                <th scope="col" className="px-5 py-3.5">Purpose / Notes</th>
                <th scope="col" className="px-5 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {myRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    You have not submitted any requests yet. Click "New Borrow / Reservation" above.
                  </td>
                </tr>
              ) : (
                myRequests.map((req) => {
                  const targetAsset = assets.find(a => a.id === req.asset_id);
                  const targetLoc = locations.find(l => l.id === req.location_id);

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-4 font-mono font-bold text-xs text-brand-700 whitespace-nowrap">
                        {req.request_number}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        <span className="font-semibold text-slate-800 block">
                          {req.request_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Form: {req.form_type}
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        {req.asset_id && (
                          <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            <Boxes className="w-3.5 h-3.5 text-brand-600" />
                            <span>{targetAsset ? targetAsset.name : req.asset_id}</span>
                          </div>
                        )}
                        {req.location_id && (
                          <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{targetLoc ? `${targetLoc.name} (${targetLoc.room})` : req.location_id}</span>
                          </div>
                        )}
                        {!req.asset_id && !req.location_id && (
                          <span className="text-slate-400">Exception Allocation</span>
                        )}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                        {new Date(req.start_date).toLocaleDateString()} → {new Date(req.end_date).toLocaleDateString()}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        {getStatusBadge(req.status)}
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-500 max-w-xs truncate">
                        {req.purpose}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {req.status === 'PENDING' && (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => handleOpenEdit(req)} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg" title="Edit request" aria-label={`Edit ${req.request_number}`}><Pencil className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => handleCancelRequest(req)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Cancel request" aria-label={`Cancel ${req.request_number}`}><XCircle className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE REQUEST MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editingRequestId ? 'Edit request' : 'New request'}
        maxWidth="xl"
      >
        <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs sm:text-sm">
          {formValidationErrors.length > 0 && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <ul className="list-disc pl-4 space-y-0.5">
                {formValidationErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

          {/* Form Type Tabs (Strictly Guarded by User Level) */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Select SRS Form Classification <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['BASIC', 'ADVANCED', 'EXCEPTION'] as FormType[]).map((type) => {
                const isAllowed = canAccessFormType(type);
                const isSelected = formType === type;

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSelectFormType(type)}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-brand-50 border-brand-500 text-brand-900 ring-2 ring-brand-500/20'
                        : isAllowed
                        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{type} Form</span>
                      {!isAllowed && <Lock className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">
                      {type === 'BASIC' && 'Level 0+ (All)'}
                      {type === 'ADVANCED' && 'Level 1+ Only'}
                      {type === 'EXCEPTION' && 'Level 2+ Only'}
                    </span>
                  </button>
                );
              })}
            </div>
            {user?.level === 0 && (
              <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>Level 0 accounts are restricted to the Basic Form per SRS §5.5.</span>
              </p>
            )}
          </div>

          {/* Request Type Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Request Category <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRequestType('BORROW_ASSET')}
                className={`p-3 rounded-xl border text-left font-medium transition flex items-center gap-2 ${
                  requestType === 'BORROW_ASSET'
                    ? 'bg-brand-50 border-brand-500 text-brand-900 ring-2 ring-brand-500/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Boxes className="w-4 h-4 text-brand-600" />
                <span>Borrow Equipment / Asset</span>
              </button>

              <button
                type="button"
                onClick={() => setRequestType('RESERVE_LOCATION')}
                className={`p-3 rounded-xl border text-left font-medium transition flex items-center gap-2 ${
                  requestType === 'RESERVE_LOCATION'
                    ? 'bg-brand-50 border-brand-500 text-brand-900 ring-2 ring-brand-500/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>Reserve Facility / Location</span>
              </button>
            </div>
          </div>

          {/* Asset or Location Selection */}
          {requestType === 'BORROW_ASSET' ? (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Select Asset to Borrow <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} — {a.name} ({a.category}) [{a.status}]
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Select Location to Reserve <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.building} - {l.room})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                End Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Purpose / Academic Objective <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="State the academic purpose or project description..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Special Justification for Advanced/Exception */}
          {formType !== 'BASIC' && (
            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 space-y-1">
              <label className="block font-semibold text-amber-900">
                Special Justification (Required for {formType} Form) <span className="text-rose-500">*</span>
              </label>
              <p className="text-[11px] text-amber-800 mb-1">
                Describe the high-value project, grant sponsor, or policy exception rationale:
              </p>
              <textarea
                rows={2}
                value={specialJustification}
                onChange={(e) => setSpecialJustification(e.target.value)}
                placeholder="Grant ID, faculty sponsor, after-hours requirements..."
                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          )}

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
              Submit Request (Enters PENDING)
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
