import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { api } from '../services/api';
import { Asset, Department, Faculty, University, Location, TransferItem, TransferStatus } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { 
  ArrowRightLeft, Send, CheckCircle2, Clock, Building, ArrowRight, ShieldAlert, History, Pencil, XCircle
} from 'lucide-react';

export const Transfers: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Transfer Wizard State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [destDeptId, setDestDeptId] = useState('');
  const [destLocationId, setDestLocationId] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [t, a, d, f, u, l] = await Promise.all([
        api.getTransfers(),
        api.getAssets(),
        api.getDepartments(),
        api.getFaculties(),
        api.getUniversities(),
        api.getLocations(),
      ]);
      setTransfers(t);
      setAssets(a);
      setDepartments(d);
      setFaculties(f);
      setUniversities(u);
      setLocations(l);
    } catch (err) {
      console.error('Failed to load transfers:', err);
      error('Failed to load transfer history.', 'Data Error');
    } finally {
    }
  }, [error]);

  useEffect(() => {
    // Data loading is the external synchronization this effect owns.
    // oxlint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  // Selected Asset Details
  const selectedAsset = assets.find(a => a.id === selectedAssetId);
  const sourceDept = departments.find(d => d.id === selectedAsset?.department_id);
  const sourceFac = faculties.find(f => f.id === sourceDept?.faculty_id);
  const sourceUniv = universities.find(u => u.id === sourceFac?.university_id);

  // Selected Destination Department Details
  const destDept = departments.find(d => d.id === destDeptId);
  const destFac = faculties.find(f => f.id === destDept?.faculty_id);
  const destUniv = universities.find(u => u.id === destFac?.university_id);

  // Real-time evaluation of the 4 Cases (FR4)
  const transferEvaluation = selectedAsset && destDeptId ? api.calculateTransferCase(
    selectedAsset.department_id,
    destDeptId,
    destFac?.id || '',
    destUniv?.id || ''
  ) : null;

  const handleOpenTransfer = () => {
    if (assets.length === 0) {
      error('No assets available to transfer.', 'No Assets');
      return;
    }
    const initialAsset = assets[0];
    setSelectedAssetId(initialAsset.id);
    setEditingTransferId(null);
    setDestDeptId(initialAsset.department_id); // Default to same department
    setDestLocationId(locations.find(l => l.department_id === initialAsset.department_id)?.id || '');
    setNotes('');
    setIsTransferModalOpen(true);
  };

  const handleOpenEdit = (transfer: TransferItem) => {
    setEditingTransferId(transfer.id);
    setSelectedAssetId(transfer.asset_id);
    setDestDeptId(transfer.destination_department_id);
    setDestLocationId(transfer.destination_location_id || '');
    setNotes(transfer.notes || '');
    setIsTransferModalOpen(true);
  };

  const handleCancelTransfer = async (transfer: TransferItem) => {
    if (!user || !window.confirm(`Cancel transfer ${transfer.transfer_number}?`)) return;
    const result = await api.cancelTransfer(user, transfer.id);
    if (result.success) {
      success('Transfer cancelled.', 'Transfer updated');
      loadData();
    } else error(result.error || 'Could not cancel transfer.', 'Cancel failed');
  };

  const handleAssetSelect = (assetId: string) => {
    setSelectedAssetId(assetId);
    const a = assets.find(item => item.id === assetId);
    if (a) {
      setDestDeptId(a.department_id);
      const loc = locations.find(l => l.department_id === a.department_id);
      setDestLocationId(loc ? loc.id : '');
    }
  };

  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedAsset || !destDept || !destFac || !destUniv) {
      error('Please select both source asset and destination department.', 'Validation Error');
      return;
    }

    const result = editingTransferId
      ? await api.updateTransfer(user, editingTransferId, {
          destination_department_id: destDept.id,
          destination_faculty_id: destFac.id,
          destination_university_id: destUniv.id,
          destination_location_id: destLocationId || null,
          notes: notes.trim(),
        })
      : await api.initiateTransfer(user, {
          asset_id: selectedAsset.id,
          destination_department_id: destDept.id,
          destination_faculty_id: destFac.id,
          destination_university_id: destUniv.id,
          destination_location_id: destLocationId || undefined,
          notes: notes.trim(),
        });

    if (result.success) {
          const feedbackMessage = 'feedbackMessage' in result && typeof result.feedbackMessage === 'string' ? result.feedbackMessage : 'Transfer submitted.';
          success(editingTransferId ? 'Transfer updated.' : feedbackMessage, editingTransferId ? 'Transfer updated' : 'Transfer Status');
      setIsTransferModalOpen(false);
      loadData();
    } else {
      error(result.error || 'Transfer could not be submitted.', 'Transfer Error');
    }
  };

  const getStatusBadge = (status: TransferStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success" size="sm">COMPLETED (Auto / Approved)</Badge>;
      case 'CANCELLED':
        return <Badge variant="default" size="sm">CANCELLED</Badge>;
      case 'PENDING_DA_APPROVAL':
        return <Badge variant="warning" size="sm">PENDING DA APPROVAL</Badge>;
      case 'PENDING_FACULTY_APPROVAL':
        return <Badge variant="purple" size="sm">PENDING FACULTY APPROVAL</Badge>;
      case 'PENDING_UNIVERSITY_APPROVAL':
        return <Badge variant="danger" size="sm">PENDING UNIV APPROVAL</Badge>;
      case 'REJECTED':
        return <Badge variant="danger" size="sm">REJECTED</Badge>;
      default:
        return <Badge variant="default" size="sm">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ArrowRightLeft className="w-7 h-7 text-brand-600" />
            <span>Asset Transfers</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Transfer assets between locations and departments.
          </p>
        </div>

        <button
          onClick={handleOpenTransfer}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-brand-600/20 transition"
        >
          <Send className="w-4 h-4" />
          <span>Initiate Asset Transfer</span>
        </button>
      </div>

      {/* Transfer workflow summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white border border-emerald-200 rounded-xl shadow-sm text-xs space-y-1">
          <div className="font-bold text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>CASE 1: Same Dept</span>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Source & destination in same department. <strong>Automatically accepted</strong> without approval.
          </p>
        </div>

        <div className="p-3.5 bg-white border border-amber-200 rounded-xl shadow-sm text-xs space-y-1">
          <div className="font-bold text-amber-800 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>CASE 2: Diff Dept (Same Faculty)</span>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Inter-departmental transfer in same faculty. Requires <strong>DA + Faculty Approval</strong>.
          </p>
        </div>

        <div className="p-3.5 bg-white border border-purple-200 rounded-xl shadow-sm text-xs space-y-1">
          <div className="font-bold text-purple-800 flex items-center gap-1.5">
            <Building className="w-4 h-4 text-purple-600" />
            <span>CASE 3: Diff Faculty</span>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Source & destination faculties differ. Requires <strong>Faculty-level Approval</strong>.
          </p>
        </div>

        <div className="p-3.5 bg-white border border-rose-200 rounded-xl shadow-sm text-xs space-y-1">
          <div className="font-bold text-rose-800 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>CASE 4: Outside University</span>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Destination outside institution. Requires <strong>University-level Central Approval</strong>.
          </p>
        </div>
      </div>

      {/* Transfer History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-800">Transfer history</h2>
          </div>
          <span className="text-xs text-slate-400">{transfers.length} Total Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th scope="col" className="px-5 py-3.5">Transfer #</th>
                <th scope="col" className="px-5 py-3.5">Asset</th>
                <th scope="col" className="px-5 py-3.5">Source → Destination</th>
                <th scope="col" className="px-5 py-3.5">Transfer Classification</th>
                <th scope="col" className="px-5 py-3.5">Status</th>
                <th scope="col" className="px-5 py-3.5">Notes</th>
                <th scope="col" className="px-5 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No transfers initiated yet.
                  </td>
                </tr>
              ) : (
                transfers.map((trf) => {
                  const sDept = departments.find(d => d.id === trf.source_department_id);
                  const dDept = departments.find(d => d.id === trf.destination_department_id);
                  const dFac = faculties.find(f => f.id === trf.destination_faculty_id);
                  const dUniv = universities.find(u => u.id === trf.destination_university_id);

                  return (
                    <tr key={trf.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-4 font-mono font-bold text-xs text-brand-700 whitespace-nowrap">
                        {trf.transfer_number}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 block">{trf.asset_id}</span>
                        <span className="text-xs text-slate-400">{trf.asset?.name || 'Asset'}</span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-2 font-medium text-slate-800">
                          <span>{sDept?.code}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="text-brand-700 font-bold">{dDept?.code}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {dFac?.code} • {dUniv?.code}
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        <span className="font-medium text-slate-700 block">{trf.transfer_type.replace(/_/g, ' ')}</span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        {getStatusBadge(trf.status)}
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-500 max-w-xs truncate">
                        {trf.notes || '—'}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {trf.requested_by === user?.id && ['PENDING_APPROVAL', 'PENDING_DA_APPROVAL', 'PENDING_FACULTY_APPROVAL', 'PENDING_UNIVERSITY_APPROVAL'].includes(trf.status) && (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => handleOpenEdit(trf)} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg" title="Edit transfer" aria-label={`Edit ${trf.transfer_number}`}><Pencil className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => handleCancelTransfer(trf)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Cancel transfer" aria-label={`Cancel ${trf.transfer_number}`}><XCircle className="w-3.5 h-3.5" /></button>
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

      {/* INITIATE TRANSFER MODAL */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title={editingTransferId ? 'Edit transfer' : 'New transfer'}
        maxWidth="xl"
      >
        <form onSubmit={handleSubmitTransfer} className="space-y-4 text-xs sm:text-sm">
          {/* Select Source Asset */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Select Source Asset <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedAssetId}
              onChange={(e) => handleAssetSelect(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id} — {a.name} ({departments.find(d => d.id === a.department_id)?.code})
                </option>
              ))}
            </select>
          </div>

          {/* Current Source Info Card */}
          {selectedAsset && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px]">Source Asset Origin:</span>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-700">
                <span>Dept: <strong>{sourceDept?.name} ({sourceDept?.code})</strong></span>
                <span>Faculty: <strong>{sourceFac?.name}</strong></span>
                <span>Univ: <strong>{sourceUniv?.name}</strong></span>
              </div>
            </div>
          )}

          {/* Destination Department Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Destination Department <span className="text-rose-500">*</span>
            </label>
            <select
              value={destDeptId}
              onChange={(e) => {
                setDestDeptId(e.target.value);
                const loc = locations.find(l => l.department_id === e.target.value);
                setDestLocationId(loc ? loc.id : '');
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code}) — {faculties.find(f => f.id === d.faculty_id)?.name}
                </option>
              ))}
            </select>
          </div>

          {/* Destination Location Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Destination Room / Space</label>
            <select
              value={destLocationId}
              onChange={(e) => setDestLocationId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
            >
              <option value="">-- Select Destination Location --</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.building} - {l.room})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Transfer Purpose / Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide reason for asset transfer..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* REAL-TIME CASE & WORKFLOW PATH EVALUATION BANNER (MANDATORY REQUIREMENT) */}
          {transferEvaluation && (
            <div className={`p-4 rounded-xl border text-xs space-y-2 ${
              transferEvaluation.autoApproved
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}>
              <div className="flex items-center justify-between font-bold text-sm">
                <span>{transferEvaluation.description}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                  transferEvaluation.autoApproved ? 'bg-emerald-200 text-emerald-900' : 'bg-blue-200 text-blue-900'
                }`}>
                  CASE {transferEvaluation.caseNumber}
                </span>
              </div>

              <div className="text-xs">
                <strong>Required Approval Path: </strong>
                <span className="font-semibold underline">{transferEvaluation.approvalPath}</span>
              </div>

              <p className="text-[11px] opacity-90">
                {transferEvaluation.autoApproved
                  ? 'As source and destination are within the same department, this transfer will complete automatically without administrative delay.'
                  : 'Transfer will be persisted and routed to authorized administrators in the Approvals queue.'}
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow-md shadow-brand-600/20"
            >
              {transferEvaluation?.autoApproved ? 'Complete Transfer Now' : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
