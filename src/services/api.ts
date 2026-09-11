import {
  Asset, Location, RequestItem, TransferItem, UserProfile, PermissionCode,
  Department, Faculty, University, Permission, Role,
} from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const permissionMap: Record<string, PermissionCode> = {
  'asset:list': 'view_inventory', 'asset:show': 'view_inventory',
  'asset:create': 'manage_assets', 'asset:edit': 'manage_assets',
  'location:create': 'create_locations', 'request:create': 'create_advanced_requests',
  'request:approval': 'approve_requests', 'user:edit': 'delegate_permissions',
};

const databasePermissionMap: Record<PermissionCode, string> = {
  view_inventory: 'asset:list', manage_assets: 'asset:edit', create_locations: 'location:create',
  create_advanced_requests: 'request:create', create_exception_requests: 'request:create',
  approve_department_transfers: 'request:approval', approve_faculty_transfers: 'request:approval',
  approve_university_transfers: 'request:approval', approve_requests: 'request:approval',
  delegate_permissions: 'user:edit',
};

const roleMap: Record<string, Role['id']> = {
  USER: 'STANDARD_USER', DEPARTMENT_ADMIN: 'DEPARTMENT_ADMIN', FACULTY_ADMIN: 'FACULTY_ADMIN',
  UNIVERSITY_ADMIN: 'UNIVERSITY_ADMIN', INVENTORY_ADMIN: 'IT_GROUP_MEMBER', IT_ADMIN: 'UNIVERSITY_ADMIN',
};

function requireSupabase(): void {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

async function getReferenceData(): Promise<{ universities: University[]; faculties: Faculty[]; departments: Department[]; roles: Role[] }> {
  requireSupabase();
  const [universities, faculties, departments, roles] = await Promise.all([
    supabase.from('universities').select('*').order('name'), supabase.from('faculties').select('*').order('name'),
    supabase.from('departments').select('*').order('name'), supabase.from('roles').select('*').order('default_level'),
  ]);
  if (universities.error) throw universities.error;
  if (faculties.error) throw faculties.error;
  if (departments.error) throw departments.error;
  if (roles.error) throw roles.error;
  return { universities: universities.data || [], faculties: faculties.data || [], departments: departments.data || [], roles: roles.data || [] };
}

async function getUserProfile(id: string): Promise<UserProfile | null> {
  requireSupabase();
  const { data: profile, error } = await supabase.from('profiles').select('id, username, full_name, email, role, level, university_part_id').eq('id', id).maybeSingle();
  if (error || !profile) return null;
  const { data: permissionRows } = await supabase.from('user_permissions').select('permission_id').eq('user_id', id);
  const ids = (permissionRows || []).map(row => row.permission_id);
  const { data: permissions } = ids.length ? await supabase.from('permissions').select('id, name').in('id', ids) : { data: [] as { id: string; name: string }[] };
  const references = await getReferenceData();
  const roleId = roleMap[profile.role] || 'STANDARD_USER';
  return {
    id: profile.id, username: profile.username, full_name: profile.full_name, email: profile.email,
    role_id: roleId, level: Number(String(profile.level).replace('LEVEL_', '')) as UserProfile['level'],
    department_id: null, faculty_id: null, university_id: profile.university_part_id,
    university: references.universities.find(item => item.id === profile.university_part_id),
    role: references.roles.find(item => item.id === roleId),
    permissions: (permissions || []).map(item => permissionMap[item.name]).filter(Boolean),
  };
}

async function getAssetsWithReferences(): Promise<Asset[]> {
  requireSupabase();
  const [{ data, error }, references] = await Promise.all([
    supabase.from('assets').select('*').order('created_at', { ascending: false }), getReferenceData(),
  ]);
  if (error) throw error;
  const locations = await api.getLocations();
  return (data || []).map(asset => ({ ...asset,
    department: references.departments.find(item => item.id === asset.department_id),
    faculty: references.faculties.find(item => item.id === asset.faculty_id),
    university: references.universities.find(item => item.id === asset.university_id),
    location: locations.find(item => item.id === asset.location_id),
  })) as Asset[];
}

export const api = {
  isLiveSupabase: isSupabaseConfigured,
  async getUniversities(): Promise<University[]> { return (await getReferenceData()).universities; },
  async getFaculties(): Promise<Faculty[]> { return (await getReferenceData()).faculties; },
  async getDepartments(): Promise<Department[]> { return (await getReferenceData()).departments; },
  async getRoles(): Promise<Role[]> { return (await getReferenceData()).roles; },
  async getPermissions(): Promise<Permission[]> {
    requireSupabase();
    const { data, error } = await supabase.from('permissions').select('name, category, description').order('name');
    if (error) throw error;
    const permissionIds = Object.entries(databasePermissionMap).reduce<Record<string, PermissionCode>>((result, [id, name]) => {
      result[name] = id as PermissionCode;
      return result;
    }, {});
    return (data || []).map(permission => ({
      id: permissionIds[permission.name] || permission.name as PermissionCode,
      name: permission.name,
      category: permission.category || 'Access',
      description: permission.description || '',
    }));
  },

  async getUsers(): Promise<UserProfile[]> {
    requireSupabase();
    const { data, error } = await supabase.from('profiles').select('id');
    if (error) throw error;
    return (await Promise.all((data || []).map(profile => getUserProfile(profile.id)))).filter((item): item is UserProfile => Boolean(item));
  },
  async getEmailByUsername(username: string): Promise<string | null> {
    requireSupabase();
    const { data } = await supabase.from('profiles').select('email').eq('username', username.toLowerCase()).maybeSingle();
    return data?.email || null;
  },
  async ensureSupabaseProfile(data: { id: string; username: string; full_name: string; email: string }): Promise<void> {
    requireSupabase();
    const { error } = await supabase.from('profiles').upsert({ ...data, level: 'LEVEL_0', role: 'USER' }, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
    const { data: permission } = await supabase.from('permissions').select('id').eq('name', 'asset:list').maybeSingle();
    if (permission) await supabase.from('user_permissions').upsert({ user_id: data.id, permission_id: permission.id }, { onConflict: 'user_id,permission_id', ignoreDuplicates: true });
  },
  async getUserById(id: string): Promise<UserProfile | null> { return getUserProfile(id); },

  async updateUserProfile(actingUser: UserProfile, targetUserId: string, updates: { full_name: string; username: string; role: UserProfile['role_id']; level: UserProfile['level'] }): Promise<{ success: boolean; error?: string }> {
    if (actingUser.role_id !== 'UNIVERSITY_ADMIN' && !actingUser.permissions.includes('delegate_permissions')) return { success: false, error: 'You do not have permission to manage user profiles.' };
    if (!updates.full_name.trim() || !updates.username.trim()) return { success: false, error: 'Name and username are required.' };
    requireSupabase();
    const dbRole = updates.role === 'IT_GROUP_MEMBER' ? 'IT_ADMIN' : updates.role === 'RESEARCH_STAFF' || updates.role === 'STANDARD_USER' ? 'USER' : updates.role;
    const { error } = await supabase.from('profiles').update({ full_name: updates.full_name.trim(), username: updates.username.trim().toLowerCase(), role: dbRole, level: `LEVEL_${updates.level}`, updated_at: new Date().toISOString() }).eq('id', targetUserId);
    return error ? { success: false, error: error.message } : { success: true };
  },
  async delegatePermissions(actingUser: UserProfile, targetUserId: string, newPermissions: PermissionCode[]): Promise<{ success: boolean; error?: string }> {
    const canDelegate = actingUser.permissions.includes('delegate_permissions') || ['UNIVERSITY_ADMIN', 'FACULTY_ADMIN', 'DEPARTMENT_ADMIN'].includes(actingUser.role_id);
    if (!canDelegate) return { success: false, error: 'You do not have permission to delegate permissions.' };
    const unauthorized = newPermissions.filter(permission => !actingUser.permissions.includes(permission));
    if (unauthorized.length) return { success: false, error: `You cannot assign permissions greater than your own. Unauthorized permissions: ${unauthorized.join(', ')}` };
    requireSupabase();
    const { data: rows, error } = await supabase.from('permissions').select('id').in('name', newPermissions.map(permission => databasePermissionMap[permission]));
    if (error) return { success: false, error: error.message };
    const deleted = await supabase.from('user_permissions').delete().eq('user_id', targetUserId);
    if (deleted.error) return { success: false, error: deleted.error.message };
    if (rows?.length) {
      const inserted = await supabase.from('user_permissions').insert(rows.map(row => ({ user_id: targetUserId, permission_id: row.id, granted_by: actingUser.id })));
      if (inserted.error) return { success: false, error: inserted.error.message };
    }
    return { success: true };
  },

  async getAssets(): Promise<Asset[]> { return getAssetsWithReferences(); },
  async createAsset(currentUser: UserProfile, data: Omit<Asset, 'created_at' | 'updated_at'>): Promise<{ success: boolean; data?: Asset; error?: string }> {
    if (!currentUser.permissions.includes('manage_assets')) return { success: false, error: 'You do not have permission to add new assets.' };
    if (currentUser.level < 2 && currentUser.department_id && data.department_id !== currentUser.department_id) return { success: false, error: 'You can only create assets within your authorized department.' };
    requireSupabase();
    const { data: asset, error } = await supabase.from('assets').insert({ ...data, created_by: currentUser.id }).select().single();
    return error ? { success: false, error: error.message } : { success: true, data: asset as Asset };
  },
  async updateAsset(currentUser: UserProfile, assetId: string, updates: Partial<Asset>): Promise<{ success: boolean; data?: Asset; error?: string }> {
    if (updates.id && updates.id !== assetId) return { success: false, error: 'Asset ID is immutable and cannot be changed.' };
    if (!currentUser.permissions.includes('manage_assets')) return { success: false, error: 'You do not have permission to modify assets.' };
    if (currentUser.level === 0) return { success: false, error: 'Unauthorized: Level 0 users do not have asset management privileges.' };
    requireSupabase();
    const { data, error } = await supabase.from('assets').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', assetId).select().single();
    return error ? { success: false, error: error.message } : { success: true, data: data as Asset };
  },

  async getLocations(): Promise<Location[]> {
    requireSupabase();
    const [{ data, error }, departments] = await Promise.all([supabase.from('locations').select('*').order('name'), this.getDepartments()]);
    if (error) throw error;
    return (data || []).map(location => ({ ...location, department: departments.find(item => item.id === location.department_id) })) as Location[];
  },
  async createLocation(currentUser: UserProfile, data: { name: string; building: string; room: string; department_id: string; exception_request_id: string }): Promise<{ success: boolean; data?: Location; error?: string }> {
    if (currentUser.role_id !== 'IT_GROUP_MEMBER' && !currentUser.permissions.includes('create_locations')) return { success: false, error: 'You are not authorized to create a location.' };
    if (!data.exception_request_id) return { success: false, error: 'An approved/valid exception request is required to create a new location.' };
    requireSupabase();
    const { data: request } = await supabase.from('requests').select('form_type,status').eq('id', data.exception_request_id).maybeSingle();
    if (!request) return { success: false, error: 'The specified request does not exist.' };
    if (request.form_type !== 'EXCEPTION' || !['APPROVED', 'WAITING_FOR_EXECUTION'].includes(request.status)) return { success: false, error: 'An approved exception request is required.' };
    const { data: location, error } = await supabase.from('locations').insert({ ...data, created_by: currentUser.id }).select().single();
    return error ? { success: false, error: error.message } : { success: true, data: location as Location };
  },
  async updateLocation(currentUser: UserProfile, locationId: string, updates: Pick<Location, 'name' | 'building' | 'room' | 'department_id' | 'is_active'>): Promise<{ success: boolean; data?: Location; error?: string }> {
    if (!currentUser.permissions.includes('create_locations') && currentUser.role_id !== 'IT_GROUP_MEMBER') return { success: false, error: 'You do not have permission to edit locations.' };
    requireSupabase();
    const { data, error } = await supabase.from('locations').update(updates).eq('id', locationId).select().single();
    return error ? { success: false, error: error.message } : { success: true, data: data as Location };
  },
  async deleteLocation(currentUser: UserProfile, locationId: string): Promise<{ success: boolean; error?: string }> {
    if (!currentUser.permissions.includes('create_locations') && currentUser.role_id !== 'IT_GROUP_MEMBER') return { success: false, error: 'You do not have permission to delete locations.' };
    requireSupabase();
    const { count } = await supabase.from('assets').select('id', { count: 'exact', head: true }).eq('location_id', locationId);
    if (count) return { success: false, error: 'This location cannot be deleted while assets are assigned to it.' };
    const { error } = await supabase.from('locations').delete().eq('id', locationId);
    return error ? { success: false, error: error.message } : { success: true };
  },

  async getRequests(): Promise<RequestItem[]> {
    requireSupabase();
    const [{ data, error }, assets, locations, users] = await Promise.all([supabase.from('requests').select('*').order('created_at', { ascending: false }), this.getAssets(), this.getLocations(), this.getUsers()]);
    if (error) throw error;
    return (data || []).map(request => ({ ...request, requester: users.find(user => user.id === request.user_id), asset: assets.find(asset => asset.id === request.asset_id), location: locations.find(location => location.id === request.location_id) })) as RequestItem[];
  },
  async createRequest(currentUser: UserProfile, data: { request_type: RequestItem['request_type']; form_type: RequestItem['form_type']; asset_id?: string; location_id?: string; start_date: string; end_date: string; purpose: string; special_justification?: string; department_id?: string }): Promise<{ success: boolean; data?: RequestItem; error?: string }> {
    if (currentUser.level === 0 && data.form_type !== 'BASIC') return { success: false, error: 'Level 0 users can only submit Basic forms.' };
    if (data.form_type === 'ADVANCED' && currentUser.level < 1 && !currentUser.permissions.includes('create_advanced_requests')) return { success: false, error: 'You are not authorized to use the Advanced request form.' };
    if (data.form_type === 'EXCEPTION' && currentUser.level < 2 && !currentUser.permissions.includes('create_exception_requests')) return { success: false, error: 'You are not authorized to use the Exception request form.' };
    if (!data.purpose || !data.start_date || !data.end_date) return { success: false, error: 'Please complete all required fields.' };
    if (data.request_type === 'BORROW_ASSET' && !data.asset_id) return { success: false, error: 'Please select an asset to borrow.' };
    if (data.request_type === 'RESERVE_LOCATION' && !data.location_id) return { success: false, error: 'Please select a location to reserve.' };
    requireSupabase();
    const prefix = data.request_type === 'BORROW_ASSET' ? 'REQ-BOR' : data.request_type === 'RESERVE_LOCATION' ? 'REQ-RES' : 'REQ-EXC';
    const { count } = await supabase.from('requests').select('id', { count: 'exact', head: true });
    const request = { ...data, id: `req-${crypto.randomUUID()}`, request_number: `${prefix}-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`, user_id: currentUser.id, asset_id: data.asset_id || null, location_id: data.location_id || null, status: 'PENDING', department_id: data.department_id || currentUser.department_id, faculty_id: currentUser.faculty_id, university_id: currentUser.university_id };
    const { data: created, error } = await supabase.from('requests').insert(request).select().single();
    return error ? { success: false, error: error.message } : { success: true, data: { ...created, requester: currentUser } as RequestItem };
  },
  async updateRequest(currentUser: UserProfile, requestId: string, updates: Pick<RequestItem, 'asset_id' | 'location_id' | 'start_date' | 'end_date' | 'purpose' | 'special_justification'>): Promise<{ success: boolean; data?: RequestItem; error?: string }> {
    requireSupabase();
    const { data: existing } = await supabase.from('requests').select('*').eq('id', requestId).maybeSingle();
    if (!existing || existing.user_id !== currentUser.id || existing.status !== 'PENDING') return { success: false, error: 'Only your pending requests can be edited.' };
    const { data, error } = await supabase.from('requests').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', requestId).select().single();
    return error ? { success: false, error: error.message } : { success: true, data: { ...data, requester: currentUser } as RequestItem };
  },
  async cancelRequest(currentUser: UserProfile, requestId: string): Promise<{ success: boolean; error?: string }> {
    requireSupabase();
    const { data: existing } = await supabase.from('requests').select('user_id,status').eq('id', requestId).maybeSingle();
    if (!existing || existing.user_id !== currentUser.id || existing.status !== 'PENDING') return { success: false, error: 'Only your pending requests can be cancelled.' };
    const { error } = await supabase.from('requests').update({ status: 'CANCELLED', updated_at: new Date().toISOString() }).eq('id', requestId);
    return error ? { success: false, error: error.message } : { success: true };
  },

  calculateTransferCase(sourceDeptId: string, destDeptId: string, destFacultyId: string, destUnivId: string) {
    if (sourceDeptId !== destDeptId && destUnivId !== 'univ-1') return { caseNumber: 4 as const, type: 'OUTSIDE_UNIVERSITY' as const, approvalPath: 'Central University Administrator Approval', description: 'Case 4: Outside University — Requires University-level approval.', autoApproved: false };
    if (sourceDeptId !== destDeptId && destFacultyId === 'fac-fos') return { caseNumber: 3 as const, type: 'DIFF_FACULTY' as const, approvalPath: 'Faculty Dean / Administrator Approval', description: 'Case 3: Different Faculty — Requires Faculty-level approval.', autoApproved: false };
    if (sourceDeptId !== destDeptId) return { caseNumber: 2 as const, type: 'DIFF_DEPT_SAME_FACULTY' as const, approvalPath: 'Department Administrator (DA) & Faculty Approval', description: 'Case 2: Different Department, Same Faculty — Requires DA + Faculty approval workflow.', autoApproved: false };
    return { caseNumber: 1 as const, type: 'SAME_DEPARTMENT' as const, approvalPath: 'Automatic (No approval required)', description: 'Case 1: Same Department — Transfer is automatically accepted/updated.', autoApproved: true };
  },
  async getTransfers(): Promise<TransferItem[]> {
    requireSupabase();
    const [{ data, error }, assets, locations, departments, faculties, universities, users] = await Promise.all([supabase.from('transfers').select('*').order('created_at', { ascending: false }), this.getAssets(), this.getLocations(), this.getDepartments(), this.getFaculties(), this.getUniversities(), this.getUsers()]);
    if (error) throw error;
    return (data || []).map(transfer => ({ ...transfer, asset: assets.find(item => item.id === transfer.asset_id), source_department: departments.find(item => item.id === transfer.source_department_id), destination_department: departments.find(item => item.id === transfer.destination_department_id), destination_faculty: faculties.find(item => item.id === transfer.destination_faculty_id), destination_university: universities.find(item => item.id === transfer.destination_university_id), destination_location: locations.find(item => item.id === transfer.destination_location_id), requester: users.find(item => item.id === transfer.requested_by) })) as TransferItem[];
  },
  async initiateTransfer(currentUser: UserProfile, data: { asset_id: string; destination_department_id: string; destination_faculty_id: string; destination_university_id: string; destination_location_id?: string; notes?: string }): Promise<{ success: boolean; data?: TransferItem; feedbackMessage: string; error?: string }> {
    requireSupabase();
    const { data: asset } = await supabase.from('assets').select('*').eq('id', data.asset_id).maybeSingle();
    if (!asset) return { success: false, feedbackMessage: 'Transfer could not be submitted.', error: 'Asset not found.' };
    const departments = await this.getDepartments();
    const faculties = await this.getFaculties();
    const sourceFaculty = faculties.find(item => item.id === departments.find(item => item.id === asset.department_id)?.faculty_id);
    const evaluation = sourceFaculty?.university_id !== data.destination_university_id ? 4 : sourceFaculty?.id !== data.destination_faculty_id ? 3 : asset.department_id !== data.destination_department_id ? 2 : 1;
    const status = evaluation === 1 ? 'COMPLETED' : evaluation === 2 ? 'PENDING_DA_APPROVAL' : evaluation === 3 ? 'PENDING_FACULTY_APPROVAL' : 'PENDING_UNIVERSITY_APPROVAL';
    const type = evaluation === 1 ? 'SAME_DEPARTMENT' : evaluation === 2 ? 'DIFF_DEPT_SAME_FACULTY' : evaluation === 3 ? 'DIFF_FACULTY' : 'OUTSIDE_UNIVERSITY';
    const { count } = await supabase.from('transfers').select('id', { count: 'exact', head: true });
    const transfer = { ...data, id: `trf-${crypto.randomUUID()}`, transfer_number: `TRF-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`, source_department_id: asset.department_id, transfer_type: type, status, requested_by: currentUser.id };
    const { data: created, error } = await supabase.from('transfers').insert(transfer).select().single();
    if (error) return { success: false, feedbackMessage: 'Transfer could not be submitted.', error: error.message };
    if (evaluation === 1 && data.destination_location_id) await supabase.from('assets').update({ location_id: data.destination_location_id, updated_at: new Date().toISOString() }).eq('id', asset.id);
    return { success: true, data: created as TransferItem, feedbackMessage: evaluation === 1 ? 'Transfer completed automatically.' : 'Transfer submitted. Approval required.' };
  },
  async updateTransfer(currentUser: UserProfile, transferId: string, updates: Pick<TransferItem, 'destination_department_id' | 'destination_faculty_id' | 'destination_university_id' | 'destination_location_id' | 'notes'>): Promise<{ success: boolean; data?: TransferItem; error?: string }> {
    requireSupabase();
    const { data: existing } = await supabase.from('transfers').select('*').eq('id', transferId).maybeSingle();
    if (!existing || existing.requested_by !== currentUser.id) return { success: false, error: 'You can only edit your own transfers.' };
    const { data, error } = await supabase.from('transfers').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', transferId).select().single();
    return error ? { success: false, error: error.message } : { success: true, data: data as TransferItem };
  },
  async cancelTransfer(currentUser: UserProfile, transferId: string): Promise<{ success: boolean; error?: string }> {
    requireSupabase();
    const { data: transfer } = await supabase.from('transfers').select('requested_by,status').eq('id', transferId).maybeSingle();
    if (!transfer || transfer.requested_by !== currentUser.id || !String(transfer.status).startsWith('PENDING')) return { success: false, error: 'Only your pending transfers can be cancelled.' };
    const { error } = await supabase.from('transfers').update({ status: 'CANCELLED', updated_at: new Date().toISOString() }).eq('id', transferId);
    return error ? { success: false, error: error.message } : { success: true };
  },
  async getAuthorizedPendingRequests(currentUser: UserProfile): Promise<{ requests: RequestItem[]; transfers: TransferItem[] }> {
    const [requests, transfers] = await Promise.all([this.getRequests(), this.getTransfers()]);
    return {
      requests: requests.filter(request => request.status === 'PENDING' && (currentUser.role_id === 'UNIVERSITY_ADMIN' || (currentUser.role_id === 'FACULTY_ADMIN' && request.faculty_id === currentUser.faculty_id) || (currentUser.role_id === 'DEPARTMENT_ADMIN' && request.department_id === currentUser.department_id) || (currentUser.role_id === 'IT_GROUP_MEMBER' && request.request_type === 'CREATE_LOCATION_EXCEPTION'))),
      transfers: transfers.filter(transfer => (transfer.status === 'PENDING_UNIVERSITY_APPROVAL' && (currentUser.role_id === 'UNIVERSITY_ADMIN' || currentUser.permissions.includes('approve_university_transfers'))) || (transfer.status === 'PENDING_FACULTY_APPROVAL' && (currentUser.role_id === 'UNIVERSITY_ADMIN' || (currentUser.role_id === 'FACULTY_ADMIN' && currentUser.faculty_id === transfer.destination_faculty_id) || currentUser.permissions.includes('approve_faculty_transfers'))) || (transfer.status === 'PENDING_DA_APPROVAL' && (currentUser.role_id === 'UNIVERSITY_ADMIN' || (currentUser.role_id === 'DEPARTMENT_ADMIN' && currentUser.department_id === transfer.source_department_id) || currentUser.permissions.includes('approve_department_transfers')))),
    };
  },
  async approveRequest(currentUser: UserProfile, requestId: string, comments?: string): Promise<{ success: boolean; error?: string }> { return this.setRequestStatus(requestId, 'WAITING_FOR_EXECUTION', comments); },
  async rejectRequest(currentUser: UserProfile, requestId: string, comments?: string): Promise<{ success: boolean; error?: string }> { return this.setRequestStatus(requestId, 'REJECTED', comments); },
  async setRequestStatus(requestId: string, status: string, comments?: string): Promise<{ success: boolean; error?: string }> {
    requireSupabase();
    const { error } = await supabase.from('requests').update({ status, special_justification: comments || undefined, updated_at: new Date().toISOString() }).eq('id', requestId);
    return error ? { success: false, error: error.message } : { success: true };
  },
  async approveTransfer(currentUser: UserProfile, transferId: string, comments?: string): Promise<{ success: boolean; error?: string }> { return this.setTransferStatus(transferId, 'COMPLETED', comments); },
  async rejectTransfer(currentUser: UserProfile, transferId: string, comments?: string): Promise<{ success: boolean; error?: string }> { return this.setTransferStatus(transferId, 'REJECTED', comments); },
  async setTransferStatus(transferId: string, status: string, comments?: string): Promise<{ success: boolean; error?: string }> {
    requireSupabase();
    const { data: transfer } = await supabase.from('transfers').select('*').eq('id', transferId).maybeSingle();
    if (!transfer) return { success: false, error: 'Transfer record not found.' };
    const nextStatus = status === 'COMPLETED' && transfer.status === 'PENDING_DA_APPROVAL' ? 'PENDING_FACULTY_APPROVAL' : status;
    const { error } = await supabase.from('transfers').update({ status: nextStatus, notes: comments || transfer.notes, updated_at: new Date().toISOString() }).eq('id', transferId);
    if (!error && nextStatus === 'COMPLETED') await supabase.from('assets').update({ department_id: transfer.destination_department_id, faculty_id: transfer.destination_faculty_id, university_id: transfer.destination_university_id, location_id: transfer.destination_location_id, status: 'AVAILABLE', updated_at: new Date().toISOString() }).eq('id', transfer.asset_id);
    return error ? { success: false, error: error.message } : { success: true };
  },
};
