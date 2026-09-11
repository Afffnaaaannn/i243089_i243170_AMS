import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { api } from '../services/api';
import { Asset, Location, Department, Faculty, University, AssetCondition, AssetStatus } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { 
  Boxes, Plus, Search, Edit3, Eye, ShieldAlert, Lock
} from 'lucide-react';

export const Inventory: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const { success, error } = useToast();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [currentAsset, setCurrentAsset] = useState<Asset | null>(null);

  // Form states
  const [formAssetId, setFormAssetId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('IT Equipment');
  const [formDepartmentId, setFormDepartmentId] = useState('');
  const [formLocationId, setFormLocationId] = useState('');
  const [formCondition, setFormCondition] = useState<AssetCondition>('GOOD');
  const [formStatus, setFormStatus] = useState<AssetStatus>('AVAILABLE');
  const [formValidationErrors, setFormValidationErrors] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [a, l, d, f, u] = await Promise.all([
        api.getAssets(),
        api.getLocations(),
        api.getDepartments(),
        api.getFaculties(),
        api.getUniversities(),
      ]);
      setAssets(a);
      setLocations(l);
      setDepartments(d);
      setFaculties(f);
      setUniversities(u);
    } catch (err) {
      console.error('Error loading inventory:', err);
      error('Failed to load inventory assets.', 'Data Error');
    } finally {
    }
  }, [error]);

  useEffect(() => {
    // Data loading is the external synchronization this effect owns.
    // oxlint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  // Filtered Assets
  const filteredAssets = assets.filter((asset) => {
    const matchesSearch = 
      asset.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDeptFilter ? asset.department_id === selectedDeptFilter : true;
    const matchesStatus = selectedStatusFilter ? asset.status === selectedStatusFilter : true;
    return matchesSearch && matchesDept && matchesStatus;
  });

  // Open Add Modal
  const handleOpenAdd = () => {
    if (!user || !hasPermission('manage_assets')) {
      error('You do not have permission to add assets.', 'Permission Denied');
      return;
    }

    setFormValidationErrors([]);
    setFormAssetId(`AST-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
    setFormName('');
    setFormDescription('');
    setFormCategory('IT Equipment');
    setFormDepartmentId(user.department_id || departments[0]?.id || '');
    setFormLocationId(locations[0]?.id || '');
    setFormCondition('GOOD');
    setFormStatus('AVAILABLE');
    setIsAddModalOpen(true);
  };

  // Submit Add
  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormValidationErrors([]);

    const errors: string[] = [];
    if (!formAssetId.trim()) errors.push('Asset ID is required.');
    if (!formName.trim()) errors.push('Asset Name is required.');
    if (!formDepartmentId) errors.push('Department is required.');
    if (!formLocationId) errors.push('Location is required.');

    if (errors.length > 0) {
      setFormValidationErrors(errors);
      error('Please complete all required fields.', 'Validation Error');
      return;
    }

    const dept = departments.find(d => d.id === formDepartmentId);
    const facultyId = dept?.faculty_id || faculties[0]?.id || '';
    const faculty = faculties.find(f => f.id === facultyId);
    const universityId = faculty?.university_id || universities[0]?.id || '';

    const result = await api.createAsset(user!, {
      id: formAssetId.trim(),
      name: formName.trim(),
      description: formDescription.trim(),
      category: formCategory,
      department_id: formDepartmentId,
      faculty_id: facultyId,
      university_id: universityId,
      location_id: formLocationId,
      condition: formCondition,
      status: formStatus,
    });

    if (result.success) {
      success('Asset created successfully.', 'Inventory Updated');
      setIsAddModalOpen(false);
      loadData();
    } else {
      error(result.error || 'Failed to create asset.', 'Operation Denied');
    }
  };

  // Open Edit Modal with authorization check
  const handleOpenEdit = (asset: Asset) => {
    if (!user) return;

    // FR2 Scope Authorization Check:
    // User must have 'manage_assets' permission
    if (!hasPermission('manage_assets')) {
      error('You do not have permission to modify this asset.', 'Authorization Denied');
      return;
    }

    // Check scope ownership:
    // Level 1 DA can only edit within their department
    if (user.level === 1 && user.department_id && asset.department_id !== user.department_id) {
      error(
        `Unauthorized: You belong to ${user.department?.code || 'your department'} and cannot modify assets in another department.`,
        'Scope Restriction'
      );
      return;
    }

    // Level 2 Faculty Admin can only edit within their faculty
    if (user.level === 2 && user.role_id === 'FACULTY_ADMIN' && user.faculty_id && asset.faculty_id !== user.faculty_id) {
      error(
        `Unauthorized: Asset belongs to another faculty outside your administrative jurisdiction.`,
        'Scope Restriction'
      );
      return;
    }

    // Level 0 users cannot edit assets
    if (user.level === 0) {
      error('You do not have permission to modify this asset.', 'Authorization Denied');
      return;
    }

    setCurrentAsset(asset);
    setFormValidationErrors([]);
    setFormAssetId(asset.id); // Immutable!
    setFormName(asset.name);
    setFormDescription(asset.description);
    setFormCategory(asset.category);
    setFormDepartmentId(asset.department_id);
    setFormLocationId(asset.location_id);
    setFormCondition(asset.condition);
    setFormStatus(asset.status);
    setIsEditModalOpen(true);
  };

  // Submit Edit
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAsset || !user) return;

    setFormValidationErrors([]);
    const errors: string[] = [];
    if (!formName.trim()) errors.push('Asset Name cannot be empty.');

    if (errors.length > 0) {
      setFormValidationErrors(errors);
      error('Please complete all required fields.', 'Validation Error');
      return;
    }

    const result = await api.updateAsset(user, currentAsset.id, {
      name: formName.trim(),
      description: formDescription.trim(),
      category: formCategory,
      location_id: formLocationId,
      condition: formCondition,
      status: formStatus,
    });

    if (result.success) {
      success('Asset updated successfully.', 'Changes Saved');
      setIsEditModalOpen(false);
      loadData();
    } else {
      error(result.error || 'Failed to update asset.', 'Operation Denied');
    }
  };

  // Open Details Modal
  const handleOpenDetails = (asset: Asset) => {
    setCurrentAsset(asset);
    setIsDetailsModalOpen(true);
  };

  const getConditionBadgeVariant = (condition: AssetCondition) => {
    switch (condition) {
      case 'NEW': return 'info';
      case 'GOOD': return 'success';
      case 'FAIR': return 'warning';
      case 'DAMAGED':
      case 'UNDER_MAINTENANCE': return 'danger';
      default: return 'default';
    }
  };

  const getStatusBadgeVariant = (status: AssetStatus) => {
    switch (status) {
      case 'AVAILABLE': return 'success';
      case 'IN_USE': return 'purple';
      case 'RESERVED': return 'warning';
      case 'TRANSFERRED': return 'info';
      case 'UNDER_MAINTENANCE':
      case 'DECOMMISSIONED': return 'danger';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Boxes className="w-7 h-7 text-brand-600" />
            <span>Asset Inventory</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage assets and track ownership.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-brand-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Asset</span>
        </button>
      </div>

      {/* Scope Alert Notice */}
      {user && (
        <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-brand-600" />
            <span>
              <strong>Your Asset Modification Scope:</strong>{' '}
              {user.level === 3 || user.role_id === 'UNIVERSITY_ADMIN' ? (
                <span className="text-emerald-700 font-semibold">Campus-wide management</span>
              ) : user.role_id === 'IT_GROUP_MEMBER' ? (
                <span className="text-brand-700 font-semibold">Inventory management</span>
              ) : user.level === 2 && user.role_id === 'FACULTY_ADMIN' ? (
                <span className="text-brand-700 font-semibold">Faculty Level ({user.faculty_id || 'FET'})</span>
              ) : user.level === 1 ? (
                <span className="text-brand-700 font-semibold">Department Level ({user.department_id || 'CSE'})</span>
              ) : (
                <span className="text-rose-700 font-semibold">Read-Only (Level 0 Student / Standard)</span>
              )}
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Assets outside your scope are view-only.
          </span>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by ID, name, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
            ))}
          </select>

          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Statuses</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="IN_USE">IN_USE</option>
            <option value="RESERVED">RESERVED</option>
            <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option>
          </select>
        </div>
      </div>

      {/* Asset Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th scope="col" className="px-5 py-3.5">Asset ID</th>
                <th scope="col" className="px-5 py-3.5">Name & Category</th>
                <th scope="col" className="px-5 py-3.5">Department</th>
                <th scope="col" className="px-5 py-3.5">Location</th>
                <th scope="col" className="px-5 py-3.5">Condition</th>
                <th scope="col" className="px-5 py-3.5">Status</th>
                <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No assets found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => {
                  const dept = departments.find(d => d.id === asset.department_id);
                  const loc = locations.find(l => l.id === asset.location_id);

                  return (
                    <tr key={asset.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-4 font-mono font-bold text-xs text-brand-700 whitespace-nowrap">
                        {asset.id}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 leading-snug">{asset.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{asset.category}</div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-medium text-slate-800">{dept?.code || 'N/A'}</span>
                        <span className="block text-[11px] text-slate-400">{dept?.name}</span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-600">
                        {loc ? `${loc.building} (${loc.room})` : 'Unassigned'}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <Badge variant={getConditionBadgeVariant(asset.condition)} size="sm">
                          {asset.condition}
                        </Badge>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <Badge variant={getStatusBadgeVariant(asset.status)} size="sm">
                          {asset.status}
                        </Badge>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-right text-xs space-x-1">
                        <button
                          onClick={() => handleOpenDetails(asset)}
                          className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"
                          title="View asset details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleOpenEdit(asset)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          title="Edit asset"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD ASSET MODAL */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Inventory Asset"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitAdd} className="space-y-4 text-xs sm:text-sm">
          {formValidationErrors.length > 0 && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <p className="font-semibold mb-1">Please fix the following validation errors:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {formValidationErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Asset ID (Immutable Once Created) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formAssetId}
              onChange={(e) => setFormAssetId(e.target.value)}
              placeholder="e.g. AST-CSE-004"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Asset IDs cannot be changed after creation.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Asset Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. 3D Laser Scanner"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Asset specifications, model number, serial..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="IT Equipment">IT Equipment</option>
                <option value="Lab Equipment">Lab Equipment</option>
                <option value="Audio/Visual">Audio/Visual</option>
                <option value="Furniture">Furniture</option>
                <option value="Vehicle">Vehicle</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={formDepartmentId}
                onChange={(e) => setFormDepartmentId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Location</label>
              <select
                value={formLocationId}
                onChange={(e) => setFormLocationId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} ({l.building})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Condition</label>
              <select
                value={formCondition}
                onChange={(e) => setFormCondition(e.target.value as AssetCondition)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="NEW">NEW</option>
                <option value="GOOD">GOOD</option>
                <option value="FAIR">FAIR</option>
                <option value="DAMAGED">DAMAGED</option>
                <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as AssetStatus)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="IN_USE">IN_USE</option>
                <option value="RESERVED">RESERVED</option>
                <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow-md shadow-brand-600/20"
            >
              Save Asset
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT ASSET MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Asset: ${currentAsset?.id}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitEdit} className="space-y-4 text-xs sm:text-sm">
          {formValidationErrors.length > 0 && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <ul className="list-disc pl-4 space-y-0.5">
                {formValidationErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

          {/* Immutable Asset ID display */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900">
            <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Asset ID is Immutable: </span>
              <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300 font-bold">
                {currentAsset?.id}
              </code>
              <p className="text-[11px] text-amber-800 mt-0.5">
                As specified in SRS §5.2–5.4, primary asset identifier cannot be modified after initial cataloging.
              </p>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Asset Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="IT Equipment">IT Equipment</option>
                <option value="Lab Equipment">Lab Equipment</option>
                <option value="Audio/Visual">Audio/Visual</option>
                <option value="Furniture">Furniture</option>
                <option value="Vehicle">Vehicle</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Location</label>
              <select
                value={formLocationId}
                onChange={(e) => setFormLocationId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} ({l.building})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Condition</label>
              <select
                value={formCondition}
                onChange={(e) => setFormCondition(e.target.value as AssetCondition)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="NEW">NEW</option>
                <option value="GOOD">GOOD</option>
                <option value="FAIR">FAIR</option>
                <option value="DAMAGED">DAMAGED</option>
                <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as AssetStatus)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="IN_USE">IN_USE</option>
                <option value="RESERVED">RESERVED</option>
                <option value="TRANSFERRED">TRANSFERRED</option>
                <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow-md shadow-brand-600/20"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* ASSET DETAILS MODAL */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="Asset Specification Details"
        maxWidth="md"
      >
        {currentAsset && (
          <div className="space-y-4 text-xs sm:text-sm">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-mono text-brand-700 font-bold text-base">{currentAsset.id}</span>
                <Badge variant={getStatusBadgeVariant(currentAsset.status)}>{currentAsset.status}</Badge>
              </div>
              <h3 className="text-base font-bold text-slate-900">{currentAsset.name}</h3>
              <p className="text-xs text-slate-600">{currentAsset.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-slate-400 block mb-0.5">Category</span>
                <span className="font-semibold text-slate-800">{currentAsset.category}</span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-slate-400 block mb-0.5">Condition</span>
                <Badge variant={getConditionBadgeVariant(currentAsset.condition)} size="sm">
                  {currentAsset.condition}
                </Badge>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-slate-400 block mb-0.5">Department</span>
                <span className="font-semibold text-slate-800">
                  {departments.find(d => d.id === currentAsset.department_id)?.name}
                </span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-slate-400 block mb-0.5">Location</span>
                <span className="font-semibold text-slate-800">
                  {locations.find(l => l.id === currentAsset.location_id)?.name || 'Unassigned'}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};
