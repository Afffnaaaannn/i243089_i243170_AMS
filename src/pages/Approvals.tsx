import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { api } from '../services/api';
import { RequestItem, TransferItem } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { 
  CheckSquare, Check, X, ShieldAlert, ArrowRightLeft, FileText, ArrowRight
} from 'lucide-react';

export const Approvals: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [pendingRequests, setPendingRequests] = useState<RequestItem[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<TransferItem[]>([]);

  // Decision Modal
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState<'REQUEST' | 'TRANSFER'>('REQUEST');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [decisionComments, setDecisionComments] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const loadAuthorizedApprovals = useCallback(async () => {
    if (!user) return;
    try {
      // FR6: Fetches ONLY items the current admin is authorized to approve
      const { requests, transfers } = await api.getAuthorizedPendingRequests(user);
      setPendingRequests(requests);
      setPendingTransfers(transfers);
    } catch (err) {
      console.error('Failed to load authorized approvals:', err);
      error('Failed to load pending approval items.', 'Data Error');
    } finally {
    }
  }, [user, error]);

  useEffect(() => {
    // Data loading is the external synchronization this effect owns.
    // oxlint-disable-next-line react-hooks/set-state-in-effect
    void loadAuthorizedApprovals();
  }, [loadAuthorizedApprovals]);

  const handleOpenDecision = (
    type: 'REQUEST' | 'TRANSFER',
    id: string,
    action: 'APPROVE' | 'REJECT'
  ) => {
    setSelectedItemType(type);
    if (type === 'REQUEST') {
      setSelectedRequestId(id);
      setSelectedTransferId(null);
    } else {
      setSelectedTransferId(id);
      setSelectedRequestId(null);
    }
    setActionType(action);
    setDecisionComments('');
    setIsDecisionModalOpen(true);
  };

  const handleExecuteDecision = async () => {
    if (!user) return;

    if (actionType === 'REJECT' && !decisionComments.trim()) {
      error('Please provide a reason when rejecting a request or transfer.', 'Comments Required');
      return;
    }

    setIsProcessing(true);

    if (selectedItemType === 'REQUEST' && selectedRequestId) {
      if (actionType === 'APPROVE') {
        const result = await api.approveRequest(user, selectedRequestId, decisionComments);
        if (result.success) {
          success('Request approved successfully. Status moved to WAITING FOR EXECUTION.', 'Decision Recorded');
        } else {
          error(result.error || 'You do not have permission to approve this request.', 'Approval Denied');
        }
      } else {
        const result = await api.rejectRequest(user, selectedRequestId, decisionComments);
        if (result.success) {
          success('Request rejected successfully.', 'Decision Recorded');
        } else {
          error(result.error || 'Failed to reject request.', 'Rejection Error');
        }
      }
    } else if (selectedItemType === 'TRANSFER' && selectedTransferId) {
      if (actionType === 'APPROVE') {
        const result = await api.approveTransfer(user, selectedTransferId, decisionComments);
        if (result.success) {
          success('Transfer approved successfully.', 'Workflow Updated');
        } else {
          error(result.error || 'You do not have permission to approve this transfer.', 'Approval Denied');
        }
      } else {
        const result = await api.rejectTransfer(user, selectedTransferId, decisionComments);
        if (result.success) {
          success('Transfer rejected successfully.', 'Decision Recorded');
        } else {
          error(result.error || 'Failed to reject transfer.', 'Rejection Error');
        }
      }
    }

    setIsProcessing(false);
    setIsDecisionModalOpen(false);
    loadAuthorizedApprovals();
  };

  const totalPending = pendingRequests.length + pendingTransfers.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <CheckSquare className="w-7 h-7 text-brand-600" />
            <span>Administrative Approvals</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            FR6: Approving Requests (§5.8) — Strictly Scoped to Current Administrator's Privilege & Jurisdiction
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={totalPending > 0 ? 'warning' : 'success'} size="md">
            {totalPending} Action Item{totalPending === 1 ? '' : 's'} Pending
          </Badge>
        </div>
      </div>

      {/* Scope Enforcing Alert Banner */}
      <div className="p-4 rounded-2xl bg-slate-900 text-white text-xs space-y-2 shadow-md">
        <div className="flex items-center gap-2 text-brand-400 font-bold text-sm">
          <ShieldAlert className="w-4 h-4" />
          <span>FR6 Business Rule Enforcement: Privilege-Scoped Queue</span>
        </div>
        <p className="text-slate-300 leading-relaxed">
          As required by SRS §5.8, administrators only view and decide on requests within their authorized scope. 
          A Department Administrator sees only departmental requests, Faculty Deans see faculty transfers/reservations, 
          and University Admins oversee institutional transfers.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 font-mono">
          <span>Active Role: <strong className="text-white">{user?.role_id}</strong></span>
          <span>•</span>
          <span>Dept Scope: <strong className="text-white">{user?.department_id || 'All'}</strong></span>
          <span>•</span>
          <span>Faculty Scope: <strong className="text-white">{user?.faculty_id || 'All'}</strong></span>
        </div>
      </div>

      {/* SECTION 1: PENDING BORROW & RESERVATION REQUESTS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-600" />
            <h2 className="text-sm font-bold text-slate-800">Pending Borrow & Reservation Requests</h2>
          </div>
          <span className="text-xs text-slate-500 font-semibold">{pendingRequests.length} to review</span>
        </div>

        <div className="divide-y divide-slate-100">
          {pendingRequests.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No borrow or reservation requests currently require your approval.
            </div>
          ) : (
            pendingRequests.map((req) => (
              <div key={req.id} className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50/80 transition">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-brand-700">{req.request_number}</span>
                    <Badge variant="warning" size="sm">{req.form_type} FORM</Badge>
                    <Badge variant="info" size="sm">{req.request_type.replace(/_/g, ' ')}</Badge>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">{req.purpose}</h3>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>Requester: <strong>{req.requester?.full_name || req.user_id}</strong></span>
                    <span>•</span>
                    <span>Duration: {new Date(req.start_date).toLocaleDateString()} – {new Date(req.end_date).toLocaleDateString()}</span>
                  </div>

                  {req.special_justification && (
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 mt-2">
                      <span className="font-semibold text-slate-900">Justification: </span>
                      {req.special_justification}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenDecision('REQUEST', req.id, 'APPROVE')}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve (Advance to Execution)</span>
                  </button>

                  <button
                    onClick={() => handleOpenDecision('REQUEST', req.id, 'REJECT')}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 2: PENDING ASSET TRANSFERS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-slate-800">Pending Inter-Departmental Transfers (FR4 / FR6)</h2>
          </div>
          <span className="text-xs text-slate-500 font-semibold">{pendingTransfers.length} to review</span>
        </div>

        <div className="divide-y divide-slate-100">
          {pendingTransfers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No asset transfers currently require your tier of approval.
            </div>
          ) : (
            pendingTransfers.map((trf) => (
              <div key={trf.id} className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50/80 transition">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-purple-700">{trf.transfer_number}</span>
                    <Badge variant="purple" size="sm">{trf.transfer_type.replace(/_/g, ' ')}</Badge>
                    <Badge variant="warning" size="sm">{trf.status.replace(/_/g, ' ')}</Badge>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">
                    Transfer Asset: <span className="font-mono text-brand-700">{trf.asset_id}</span>
                  </h3>

                  <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <span>{trf.source_department?.name || trf.source_department_id}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="text-brand-700 font-bold">{trf.destination_department?.name || trf.destination_department_id}</span>
                  </div>

                  {trf.notes && (
                    <p className="text-xs text-slate-500 italic mt-1">"{trf.notes}"</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenDecision('TRANSFER', trf.id, 'APPROVE')}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve Transfer</span>
                  </button>

                  <button
                    onClick={() => handleOpenDecision('TRANSFER', trf.id, 'REJECT')}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* DECISION MODAL */}
      <Modal
        isOpen={isDecisionModalOpen}
        onClose={() => setIsDecisionModalOpen(false)}
        title={`${actionType === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}`}
        maxWidth="md"
      >
        <div className="space-y-4 text-xs sm:text-sm">
          <p className="text-slate-600 leading-relaxed">
            {actionType === 'APPROVE'
              ? 'Are you sure you want to approve this item? It will be advanced to the next workflow stage (WAITING FOR EXECUTION or transfer completion).'
              : 'Please enter the official rejection reason to notify the requester:'}
          </p>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Comments / Administrative Notes {actionType === 'REJECT' && <span className="text-rose-500">*</span>}
            </label>
            <textarea
              rows={3}
              value={decisionComments}
              onChange={(e) => setDecisionComments(e.target.value)}
              placeholder={actionType === 'APPROVE' ? 'Optional approval notes...' : 'Reason for rejection (mandatory)...'}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsDecisionModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleExecuteDecision}
              className={`px-5 py-2 text-white rounded-xl font-semibold shadow-md transition ${
                actionType === 'APPROVE'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
              }`}
            >
              {isProcessing ? 'Recording Decision...' : `Confirm ${actionType}`}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
