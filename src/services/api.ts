import { 
  Asset, Location, RequestItem, TransferItem, UserProfile, PermissionCode,
  Department, Faculty, University, Permission, Role
} from '../types';
import { 
  universitiesSeed, facultiesSeed, departmentsSeed, rolesSeed, permissionsSeed,
  initialLocations, initialAssets, initialRequests, initialTransfers
} from './mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Local storage keys
const STORAGE_KEYS = {
  ASSETS: 'ams_assets',
  LOCATIONS: 'ams_locations',
  REQUESTS: 'ams_requests',
  TRANSFERS: 'ams_transfers',
  USERS: 'ams_users',
  NOTIFICATIONS: 'ams_notifications',
};

// Helper for local persistence
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Failed to save ${key} to localStorage:`, err);
  }
}

function permissionMapToDatabaseName(permission: PermissionCode): string {
  const map: Record<PermissionCode, string> = {
    view_inventory: 'asset:list',
    manage_assets: 'asset:edit',
    create_locations: 'location:create',
    create_advanced_requests: 'request:create',
    create_exception_requests: 'request:create',
    approve_department_transfers: 'request:approval',
    approve_faculty_transfers: 'request:approval',
    approve_university_transfers: 'request:approval',
    approve_requests: 'request:approval',
    delegate_permissions: 'user:edit',
  };
  return map[permission];
}

// In-memory / localStorage storage container
let assetsStore: Asset[] = loadFromStorage(STORAGE_KEYS.ASSETS, initialAssets);
let locationsStore: Location[] = loadFromStorage(STORAGE_KEYS.LOCATIONS, initialLocations);
let requestsStore: RequestItem[] = loadFromStorage(STORAGE_KEYS.REQUESTS, initialRequests);
let transfersStore: TransferItem[] = loadFromStorage(STORAGE_KEYS.TRANSFERS, initialTransfers);
let usersStore: UserProfile[] = loadFromStorage(STORAGE_KEYS.USERS, []);

export const api = {
  isLiveSupabase: isSupabaseConfigured,

  // ---------------------------------------------------------------------------
  // ORGANIZATIONAL METADATA
  // ---------------------------------------------------------------------------
  async getUniversities(): Promise<University[]> {
    return universitiesSeed;
  },

  async getFaculties(): Promise<Faculty[]> {
    return facultiesSeed;
  },

  async getDepartments(): Promise<Department[]> {
    return departmentsSeed;
  },

  async getRoles(): Promise<Role[]> {
    return rolesSeed;
  },

  async getPermissions(): Promise<Permission[]> {
    return permissionsSeed;
  },

  // ---------------------------------------------------------------------------
  // USERS & PROFILES (FR1, FR7)
  // ---------------------------------------------------------------------------
  async getUsers(): Promise<UserProfile[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('profiles').select('id');
      if (error) throw error;
      return Promise.all((data || []).map(profile => this.getUserById(profile.id))).then(users => users.filter((profile): profile is UserProfile => profile !== null));
    }
    return [...usersStore];
  },

  async getEmailByUsername(username: string): Promise<string | null> {
    if (!isSupabaseConfigured) {
      const user = usersStore.find(item => item.username.toLowerCase() === username.toLowerCase());
      return user?.email || null;
    }

    const { data } = await supabase
      .from('profiles')
      .select('email')
      .eq('username', username)
      .maybeSingle();
    return data?.email || null;
  },

  async ensureSupabaseProfile(data: { id: string; username: string; full_name: string; email: string }): Promise<void> {
    if (!isSupabaseConfigured) return;

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.id,
      username: data.username,
      full_name: data.full_name,
      email: data.email,
      level: 'LEVEL_0',
      role: 'USER',
    }, { onConflict: 'id', ignoreDuplicates: true });
    if (profileError) throw profileError;

    const { data: permission } = await supabase
      .from('permissions')
      .select('id')
      .eq('name', 'asset:list')
      .maybeSingle();
    if (permission) {
      const { error: permissionError } = await supabase.from('user_permissions').upsert({
        user_id: data.id,
        permission_id: permission.id,
      }, { onConflict: 'user_id,permission_id', ignoreDuplicates: true });
      if (permissionError) throw permissionError;
    }
  },

  async createLocalUser(data: { username: string; full_name: string; email: string }): Promise<UserProfile> {
    const user: UserProfile = {
      id: `user-${crypto.randomUUID()}`,
      username: data.username,
      full_name: data.full_name,
      email: data.email,
      role_id: 'STANDARD_USER',
      level: 0,
      department_id: null,
      faculty_id: null,
      university_id: null,
      permissions: ['view_inventory'],
    };
    usersStore = [...usersStore, user];
    saveToStorage(STORAGE_KEYS.USERS, usersStore);
    return user;
  },

  async getUserById(id: string): Promise<UserProfile | null> {
    if (isSupabaseConfigured) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, email, role, level, university_part_id')
        .eq('id', id)
        .maybeSingle();
      if (error || !profile) return null;
      const { data: permissionRows } = await supabase
        .from('user_permissions')
        .select('permission_id')
        .eq('user_id', id);

      const permissionIds = (permissionRows || []).map(row => row.permission_id);
      const { data: permissions } = permissionIds.length > 0
        ? await supabase.from('permissions').select('name').in('id', permissionIds)
        : { data: [] as { name: string }[] };

      const roleMap: Record<string, Role['id']> = {
        USER: 'STANDARD_USER',
        DEPARTMENT_ADMIN: 'DEPARTMENT_ADMIN',
        FACULTY_ADMIN: 'FACULTY_ADMIN',
        UNIVERSITY_ADMIN: 'UNIVERSITY_ADMIN',
        INVENTORY_ADMIN: 'IT_GROUP_MEMBER',
        IT_ADMIN: 'UNIVERSITY_ADMIN',
      };
      const permissionMap: Record<string, PermissionCode> = {
        'asset:list': 'view_inventory',
        'asset:show': 'view_inventory',
        'asset:create': 'manage_assets',
        'asset:edit': 'manage_assets',
        'location:create': 'create_locations',
        'request:create': 'create_advanced_requests',
        'request:approval': 'approve_requests',
        'user:edit': 'delegate_permissions',
      };

      return {
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
        email: profile.email,
        role_id: roleMap[profile.role] || 'STANDARD_USER',
        level: Number(profile.level.replace('LEVEL_', '')) as UserProfile['level'],
        department_id: null,
        faculty_id: null,
        university_id: profile.university_part_id,
        permissions: (permissions || [])
          .map(permission => permissionMap[permission.name])
          .filter((permission): permission is PermissionCode => Boolean(permission)),
      };
    }
    const user = usersStore.find(u => u.id === id);
    if (!user) return null;
    return {
      ...user,
      department: departmentsSeed.find(d => d.id === user.department_id),
      faculty: facultiesSeed.find(f => f.id === user.faculty_id),
      university: universitiesSeed.find(u => u.id === user.university_id),
      role: rolesSeed.find(r => r.id === user.role_id),
    };
  },

  async updateUserProfile(
    actingUser: UserProfile,
    targetUserId: string,
    updates: { full_name: string; username: string; role: UserProfile['role_id']; level: UserProfile['level'] }
  ): Promise<{ success: boolean; error?: string }> {
    const canManageUsers = actingUser.role_id === 'UNIVERSITY_ADMIN' || actingUser.permissions.includes('delegate_permissions');
    if (!canManageUsers) return { success: false, error: 'You do not have permission to manage user profiles.' };
    if (!updates.full_name.trim() || !updates.username.trim()) return { success: false, error: 'Name and username are required.' };

    if (isSupabaseConfigured) {
      const dbRole = updates.role === 'UNIVERSITY_ADMIN' ? 'UNIVERSITY_ADMIN'
        : updates.role === 'FACULTY_ADMIN' ? 'FACULTY_ADMIN'
        : updates.role === 'DEPARTMENT_ADMIN' ? 'DEPARTMENT_ADMIN'
        : updates.role === 'IT_GROUP_MEMBER' ? 'IT_ADMIN'
        : updates.role === 'RESEARCH_STAFF' ? 'USER' : 'USER';
      const { error } = await supabase.from('profiles').update({
        full_name: updates.full_name.trim(),
        username: updates.username.trim().toLowerCase(),
        role: dbRole,
        level: `LEVEL_${updates.level}`,
        updated_at: new Date().toISOString(),
      }).eq('id', targetUserId);
      return error ? { success: false, error: error.message } : { success: true };
    }

    const target = usersStore.find(user => user.id === targetUserId);
    if (!target) return { success: false, error: 'User not found.' };
    usersStore = usersStore.map(user => user.id === targetUserId ? {
      ...user,
      full_name: updates.full_name.trim(),
      username: updates.username.trim().toLowerCase(),
      role_id: updates.role,
      level: updates.level,
    } : user);
    saveToStorage(STORAGE_KEYS.USERS, usersStore);
    return { success: true };
  },

  // FR7: Changing Permissions with strict non-escalation rule
  async delegatePermissions(
    actingUser: UserProfile,
    targetUserId: string,
    newPermissions: PermissionCode[]
  ): Promise<{ success: boolean; error?: string }> {
    // Check if acting user has permission to delegate
    const canDelegate = actingUser.permissions.includes('delegate_permissions') ||
      actingUser.role_id === 'UNIVERSITY_ADMIN' ||
      actingUser.role_id === 'FACULTY_ADMIN' ||
      actingUser.role_id === 'DEPARTMENT_ADMIN';

    if (!canDelegate) {
      return { success: false, error: 'You do not have permission to delegate permissions.' };
    }

    // CRITICAL SECURITY RULE: An administrator MUST NOT assign permissions greater than their own
    const unauthorized = newPermissions.filter(p => !actingUser.permissions.includes(p));
    if (unauthorized.length > 0) {
      return {
        success: false,
        error: `You cannot assign permissions greater than your own. Unauthorized permissions: ${unauthorized.join(', ')}`,
      };
    }

    if (isSupabaseConfigured) {
      const { data: permissionRows, error: permissionError } = await supabase
        .from('permissions')
        .select('id, name')
        .in('name', newPermissions.map(permission => permissionMapToDatabaseName(permission)));
      if (permissionError) return { success: false, error: permissionError.message };

      const { error: deleteError } = await supabase.from('user_permissions').delete().eq('user_id', targetUserId);
      if (deleteError) return { success: false, error: deleteError.message };
      if (permissionRows && permissionRows.length > 0) {
        const { error: insertError } = await supabase.from('user_permissions').insert(
          permissionRows.map(permission => ({ user_id: targetUserId, permission_id: permission.id, granted_by: actingUser.id }))
        );
        if (insertError) return { success: false, error: insertError.message };
      }
      return { success: true };
    }

    // Apply update
    usersStore = usersStore.map(u => {
      if (u.id === targetUserId) {
        return { ...u, permissions: [...newPermissions] };
      }
      return u;
    });
    saveToStorage(STORAGE_KEYS.USERS, usersStore);

    return { success: true };
  },

  // ---------------------------------------------------------------------------
  // ASSETS (FR2)
  // ---------------------------------------------------------------------------
  async getAssets(): Promise<Asset[]> {
    return assetsStore.map(a => ({
      ...a,
      department: departmentsSeed.find(d => d.id === a.department_id),
      faculty: facultiesSeed.find(f => f.id === a.faculty_id),
      university: universitiesSeed.find(u => u.id === a.university_id),
      location: locationsStore.find(l => l.id === a.location_id),
    }));
  },

  async getAssetById(id: string): Promise<Asset | null> {
    const asset = assetsStore.find(a => a.id === id);
    if (!asset) return null;
    return {
      ...asset,
      department: departmentsSeed.find(d => d.id === asset.department_id),
      faculty: facultiesSeed.find(f => f.id === asset.faculty_id),
      university: universitiesSeed.find(u => u.id === asset.university_id),
      location: locationsStore.find(l => l.id === asset.location_id),
    };
  },

  async createAsset(currentUser: UserProfile, data: Omit<Asset, 'created_at' | 'updated_at'>): Promise<{ success: boolean; data?: Asset; error?: string }> {
    // Check permission
    if (!currentUser.permissions.includes('manage_assets')) {
      return { success: false, error: 'You do not have permission to add new assets.' };
    }

    // Check scope: non-global admins must create inside their department
    if (currentUser.level < 2 && currentUser.department_id && data.department_id !== currentUser.department_id) {
      return { success: false, error: 'You can only create assets within your authorized department.' };
    }

    // Validate ID uniqueness
    if (assetsStore.some(a => a.id.toLowerCase() === data.id.toLowerCase())) {
      return { success: false, error: `Asset ID "${data.id}" already exists. Asset ID must be unique.` };
    }

    const newAsset: Asset = {
      ...data,
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    assetsStore = [newAsset, ...assetsStore];
    saveToStorage(STORAGE_KEYS.ASSETS, assetsStore);

    return { success: true, data: newAsset };
  },

  async updateAsset(currentUser: UserProfile, assetId: string, updates: Partial<Asset>): Promise<{ success: boolean; data?: Asset; error?: string }> {
    const existing = assetsStore.find(a => a.id === assetId);
    if (!existing) {
      return { success: false, error: 'Asset not found.' };
    }

    // IMMUTABLE ASSET ID RULE: ID cannot be altered
    if (updates.id && updates.id !== assetId) {
      return { success: false, error: 'Asset ID is immutable and cannot be changed.' };
    }

    // Check authorization permission
    if (!currentUser.permissions.includes('manage_assets')) {
      return { success: false, error: 'You do not have permission to modify assets.' };
    }

    // Check scope authorization
    // Level 3 / IT can edit across campus
    // Level 2 (Faculty Admin) can edit within faculty
    // Level 1 (Dept Admin) can only edit within their department
    if (currentUser.level === 1 && currentUser.department_id && existing.department_id !== currentUser.department_id) {
      return { success: false, error: 'Unauthorized: You can only modify assets belonging to your assigned department.' };
    }

    if (currentUser.level === 2 && currentUser.role_id === 'FACULTY_ADMIN' && currentUser.faculty_id && existing.faculty_id !== currentUser.faculty_id) {
      return { success: false, error: 'Unauthorized: You can only modify assets belonging to your assigned faculty.' };
    }

    if (currentUser.level === 0) {
      return { success: false, error: 'Unauthorized: Level 0 users do not have asset management privileges.' };
    }

    const updatedAsset: Asset = {
      ...existing,
      ...updates,
      id: existing.id, // Guarantee immutability
      updated_at: new Date().toISOString(),
    };

    assetsStore = assetsStore.map(a => a.id === assetId ? updatedAsset : a);
    saveToStorage(STORAGE_KEYS.ASSETS, assetsStore);

    return { success: true, data: updatedAsset };
  },

  // ---------------------------------------------------------------------------
  // LOCATIONS (FR3)
  // ---------------------------------------------------------------------------
  async getLocations(): Promise<Location[]> {
    return locationsStore.map(l => ({
      ...l,
      department: departmentsSeed.find(d => d.id === l.department_id),
    }));
  },

  // FR3 BUSINESS RULE:
  // "Only authorized IT group members can create a new location when an appropriate exception request exists."
  async createLocation(
    currentUser: UserProfile,
    data: { name: string; building: string; room: string; department_id: string; exception_request_id: string }
  ): Promise<{ success: boolean; data?: Location; error?: string }> {
    // 1. Check user authorization: must be IT Group Member or possess create_locations
    const isIT = currentUser.role_id === 'IT_GROUP_MEMBER' || currentUser.permissions.includes('create_locations');
    if (!isIT) {
      return {
        success: false,
        error: 'You are not authorized to create a location. Only authorized IT group members can perform this operation.',
      };
    }

    // 2. Check exception request existence
    if (!data.exception_request_id) {
      return {
        success: false,
        error: 'An approved/valid exception request is required to create a new location.',
      };
    }

    const exceptionReq = requestsStore.find(r => r.id === data.exception_request_id);
    if (!exceptionReq) {
      return { success: false, error: 'The specified exception request does not exist.' };
    }

    if (exceptionReq.form_type !== 'EXCEPTION') {
      return { success: false, error: 'The selected request must be an Exception Request.' };
    }

    // 3. Verify exception request is approved
    if (exceptionReq.status !== 'APPROVED' && exceptionReq.status !== 'WAITING_FOR_EXECUTION') {
      return {
        success: false,
        error: `Exception request is not approved (Current status: ${exceptionReq.status}). An approved exception is required.`,
      };
    }

    const newLocation: Location = {
      id: `loc-${Date.now()}`,
      name: data.name,
      building: data.building,
      room: data.room,
      department_id: data.department_id,
      exception_request_id: data.exception_request_id,
      created_by: currentUser.id,
      is_active: true,
      department: departmentsSeed.find(d => d.id === data.department_id),
    };

    locationsStore = [newLocation, ...locationsStore];
    saveToStorage(STORAGE_KEYS.LOCATIONS, locationsStore);

    return { success: true, data: newLocation };
  },

  async updateLocation(
    currentUser: UserProfile,
    locationId: string,
    updates: Pick<Location, 'name' | 'building' | 'room' | 'department_id' | 'is_active'>
  ): Promise<{ success: boolean; data?: Location; error?: string }> {
    if (!currentUser.permissions.includes('create_locations') && currentUser.role_id !== 'IT_GROUP_MEMBER') {
      return { success: false, error: 'You do not have permission to edit locations.' };
    }
    const existing = locationsStore.find(location => location.id === locationId);
    if (!existing) return { success: false, error: 'Location not found.' };
    if (!updates.name.trim() || !updates.building.trim() || !updates.room.trim() || !updates.department_id) {
      return { success: false, error: 'Name, building, room, and department are required.' };
    }
    const updatedLocation = { ...existing, ...updates, department: departmentsSeed.find(d => d.id === updates.department_id) };
    locationsStore = locationsStore.map(location => location.id === locationId ? updatedLocation : location);
    saveToStorage(STORAGE_KEYS.LOCATIONS, locationsStore);
    return { success: true, data: updatedLocation };
  },

  async deleteLocation(currentUser: UserProfile, locationId: string): Promise<{ success: boolean; error?: string }> {
    if (!currentUser.permissions.includes('create_locations') && currentUser.role_id !== 'IT_GROUP_MEMBER') {
      return { success: false, error: 'You do not have permission to delete locations.' };
    }
    if (!locationsStore.some(location => location.id === locationId)) {
      return { success: false, error: 'Location not found.' };
    }
    if (assetsStore.some(asset => asset.location_id === locationId)) {
      return { success: false, error: 'This location cannot be deleted while assets are assigned to it.' };
    }
    locationsStore = locationsStore.filter(location => location.id !== locationId);
    saveToStorage(STORAGE_KEYS.LOCATIONS, locationsStore);
    return { success: true };
  },

  // ---------------------------------------------------------------------------
  // REQUESTS: BORROW & RESERVATION (FR5)
  // ---------------------------------------------------------------------------
  async getRequests(): Promise<RequestItem[]> {
    return requestsStore.map(r => ({
      ...r,
      requester: usersStore.find(u => u.id === r.user_id),
      asset: r.asset_id ? assetsStore.find(a => a.id === r.asset_id) : undefined,
      location: r.location_id ? locationsStore.find(l => l.id === r.location_id) : undefined,
    }));
  },

  // FR5 BUSINESS RULE:
  // "Level 0 users can only use the Basic form. Higher-level users may access additional forms."
  async createRequest(
    currentUser: UserProfile,
    data: {
      request_type: 'BORROW_ASSET' | 'RESERVE_LOCATION' | 'CREATE_LOCATION_EXCEPTION';
      form_type: 'BASIC' | 'ADVANCED' | 'EXCEPTION';
      asset_id?: string;
      location_id?: string;
      start_date: string;
      end_date: string;
      purpose: string;
      special_justification?: string;
      department_id?: string;
    }
  ): Promise<{ success: boolean; data?: RequestItem; error?: string }> {
    // Form Type Access Rule
    if (currentUser.level === 0 && data.form_type !== 'BASIC') {
      return {
        success: false,
        error: 'You are not authorized to use this request form. Level 0 users can only submit Basic forms.',
      };
    }

    if (data.form_type === 'ADVANCED' && currentUser.level < 1 && !currentUser.permissions.includes('create_advanced_requests')) {
      return {
        success: false,
        error: 'You are not authorized to use the Advanced request form. Level 1 or higher is required.',
      };
    }

    if (data.form_type === 'EXCEPTION' && currentUser.level < 2 && !currentUser.permissions.includes('create_exception_requests')) {
      return {
        success: false,
        error: 'You are not authorized to use the Exception request form. Level 2 or higher is required.',
      };
    }

    // Required fields check
    if (!data.purpose || !data.start_date || !data.end_date) {
      return { success: false, error: 'Please complete all required fields.' };
    }

    if (data.request_type === 'BORROW_ASSET' && !data.asset_id) {
      return { success: false, error: 'Please select an asset to borrow.' };
    }

    if (data.request_type === 'RESERVE_LOCATION' && !data.location_id) {
      return { success: false, error: 'Please select a location to reserve.' };
    }

    const prefix = data.request_type === 'BORROW_ASSET' ? 'REQ-BOR' :
      data.request_type === 'RESERVE_LOCATION' ? 'REQ-RES' : 'REQ-EXC';
    const reqNum = `${prefix}-${new Date().getFullYear()}-${String(requestsStore.length + 1).padStart(3, '0')}`;

    const newRequest: RequestItem = {
      id: `req-${Date.now()}`,
      request_number: reqNum,
      request_type: data.request_type,
      form_type: data.form_type,
      user_id: currentUser.id,
      asset_id: data.asset_id || null,
      location_id: data.location_id || null,
      start_date: data.start_date,
      end_date: data.end_date,
      purpose: data.purpose,
      special_justification: data.special_justification,
      status: 'PENDING', // Initial workflow state
      department_id: data.department_id || currentUser.department_id,
      faculty_id: currentUser.faculty_id,
      university_id: currentUser.university_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      requester: currentUser,
    };

    requestsStore = [newRequest, ...requestsStore];
    saveToStorage(STORAGE_KEYS.REQUESTS, requestsStore);

    return { success: true, data: newRequest };
  },

  async updateRequest(
    currentUser: UserProfile,
    requestId: string,
    updates: Pick<RequestItem, 'asset_id' | 'location_id' | 'start_date' | 'end_date' | 'purpose' | 'special_justification'>
  ): Promise<{ success: boolean; data?: RequestItem; error?: string }> {
    const existing = requestsStore.find(request => request.id === requestId);
    if (!existing) return { success: false, error: 'Request not found.' };
    if (existing.user_id !== currentUser.id) return { success: false, error: 'You can only edit your own requests.' };
    if (existing.status !== 'PENDING') return { success: false, error: 'Only pending requests can be edited.' };
    if (!updates.purpose?.trim() || !updates.start_date || !updates.end_date) return { success: false, error: 'Purpose and dates are required.' };
    const updatedRequest = { ...existing, ...updates, purpose: updates.purpose.trim(), updated_at: new Date().toISOString() };
    requestsStore = requestsStore.map(request => request.id === requestId ? updatedRequest : request);
    saveToStorage(STORAGE_KEYS.REQUESTS, requestsStore);
    return { success: true, data: updatedRequest };
  },

  async cancelRequest(currentUser: UserProfile, requestId: string): Promise<{ success: boolean; error?: string }> {
    const existing = requestsStore.find(request => request.id === requestId);
    if (!existing) return { success: false, error: 'Request not found.' };
    if (existing.user_id !== currentUser.id) return { success: false, error: 'You can only cancel your own requests.' };
    if (existing.status !== 'PENDING') return { success: false, error: 'Only pending requests can be cancelled.' };
    requestsStore = requestsStore.map(request => request.id === requestId ? { ...request, status: 'CANCELLED', updated_at: new Date().toISOString() } : request);
    saveToStorage(STORAGE_KEYS.REQUESTS, requestsStore);
    return { success: true };
  },

  // ---------------------------------------------------------------------------
  // TRANSFERS (FR4 - 4 DISTINCT WORKFLOW CASES)
  // ---------------------------------------------------------------------------
  async getTransfers(): Promise<TransferItem[]> {
    return transfersStore.map(t => ({
      ...t,
      asset: assetsStore.find(a => a.id === t.asset_id),
      source_department: departmentsSeed.find(d => d.id === t.source_department_id),
      destination_department: departmentsSeed.find(d => d.id === t.destination_department_id),
      destination_faculty: facultiesSeed.find(f => f.id === t.destination_faculty_id),
      destination_university: universitiesSeed.find(u => u.id === t.destination_university_id),
      destination_location: locationsStore.find(l => l.id === t.destination_location_id),
      requester: usersStore.find(u => u.id === t.requested_by),
    }));
  },

  // Real-time calculation of transfer case based on org relationships
  calculateTransferCase(
    sourceDeptId: string,
    destDeptId: string,
    destFacultyId: string,
    destUnivId: string
  ): {
    caseNumber: 1 | 2 | 3 | 4;
    type: 'SAME_DEPARTMENT' | 'DIFF_DEPT_SAME_FACULTY' | 'DIFF_FACULTY' | 'OUTSIDE_UNIVERSITY';
    approvalPath: string;
    description: string;
    autoApproved: boolean;
  } {
    const sourceDept = departmentsSeed.find(d => d.id === sourceDeptId);
    const sourceFac = facultiesSeed.find(f => f.id === sourceDept?.faculty_id);
    const sourceUnivId = sourceFac?.university_id;

    if (sourceUnivId && destUnivId && sourceUnivId !== destUnivId) {
      return {
        caseNumber: 4,
        type: 'OUTSIDE_UNIVERSITY',
        approvalPath: 'Central University Administrator Approval',
        description: 'Case 4: Outside University — Requires University-level approval.',
        autoApproved: false,
      };
    }

    if (sourceDept && sourceDept.faculty_id !== destFacultyId) {
      return {
        caseNumber: 3,
        type: 'DIFF_FACULTY',
        approvalPath: 'Faculty Dean / Administrator Approval',
        description: 'Case 3: Different Faculty — Requires Faculty-level approval.',
        autoApproved: false,
      };
    }

    if (sourceDeptId !== destDeptId) {
      return {
        caseNumber: 2,
        type: 'DIFF_DEPT_SAME_FACULTY',
        approvalPath: 'Department Administrator (DA) & Faculty Approval',
        description: 'Case 2: Different Department, Same Faculty — Requires DA + Faculty approval workflow.',
        autoApproved: false,
      };
    }

    return {
      caseNumber: 1,
      type: 'SAME_DEPARTMENT',
      approvalPath: 'Automatic (No approval required)',
      description: 'Case 1: Same Department — Transfer is automatically accepted/updated.',
      autoApproved: true,
    };
  },

  async initiateTransfer(
    currentUser: UserProfile,
    data: {
      asset_id: string;
      destination_department_id: string;
      destination_faculty_id: string;
      destination_university_id: string;
      destination_location_id?: string;
      notes?: string;
    }
  ): Promise<{
    success: boolean;
    data?: TransferItem;
    feedbackMessage: string;
    error?: string;
  }> {
    const asset = assetsStore.find(a => a.id === data.asset_id);
    if (!asset) {
      return { success: false, feedbackMessage: 'Transfer could not be submitted.', error: 'Asset not found.' };
    }

    const transferEvaluation = this.calculateTransferCase(
      asset.department_id,
      data.destination_department_id,
      data.destination_faculty_id,
      data.destination_university_id
    );

    const trfNum = `TRF-${new Date().getFullYear()}-${String(transfersStore.length + 1).padStart(3, '0')}`;
    let status: TransferItem['status'];
    let feedbackMessage: string;

    switch (transferEvaluation.caseNumber) {
      case 1:
        // Case 1: Same Department -> auto completed
        status = 'COMPLETED';
        feedbackMessage = 'Transfer completed automatically.';
        // Update asset location immediately
        if (data.destination_location_id) {
          assetsStore = assetsStore.map(a => 
            a.id === asset.id ? { ...a, location_id: data.destination_location_id!, updated_at: new Date().toISOString() } : a
          );
          saveToStorage(STORAGE_KEYS.ASSETS, assetsStore);
        }
        break;

      case 2:
        // Case 2: Different Department, Same Faculty -> DA approval
        status = 'PENDING_DA_APPROVAL';
        feedbackMessage = 'Transfer submitted. Department/faculty approval required.';
        break;

      case 3:
        // Case 3: Different Faculty -> Faculty approval
        status = 'PENDING_FACULTY_APPROVAL';
        feedbackMessage = 'Transfer submitted. Faculty approval required.';
        break;

      case 4:
        // Case 4: Outside University -> University approval
        status = 'PENDING_UNIVERSITY_APPROVAL';
        feedbackMessage = 'Transfer submitted. University approval required.';
        break;
    }

    const newTransfer: TransferItem = {
      id: `trf-${Date.now()}`,
      transfer_number: trfNum,
      asset_id: data.asset_id,
      source_department_id: asset.department_id,
      destination_department_id: data.destination_department_id,
      destination_faculty_id: data.destination_faculty_id,
      destination_university_id: data.destination_university_id,
      destination_location_id: data.destination_location_id,
      transfer_type: transferEvaluation.type,
      status,
      requested_by: currentUser.id,
      notes: data.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    transfersStore = [newTransfer, ...transfersStore];
    saveToStorage(STORAGE_KEYS.TRANSFERS, transfersStore);

    return {
      success: true,
      data: newTransfer,
      feedbackMessage,
    };
  },

  async updateTransfer(
    currentUser: UserProfile,
    transferId: string,
    updates: Pick<TransferItem, 'destination_department_id' | 'destination_faculty_id' | 'destination_university_id' | 'destination_location_id' | 'notes'>
  ): Promise<{ success: boolean; data?: TransferItem; error?: string }> {
    const existing = transfersStore.find(transfer => transfer.id === transferId);
    if (!existing) return { success: false, error: 'Transfer not found.' };
    if (existing.requested_by !== currentUser.id) return { success: false, error: 'You can only edit your own transfers.' };
    if (!['PENDING_APPROVAL', 'PENDING_DA_APPROVAL', 'PENDING_FACULTY_APPROVAL', 'PENDING_UNIVERSITY_APPROVAL'].includes(existing.status)) {
      return { success: false, error: 'Only pending transfers can be edited.' };
    }
    const evaluation = this.calculateTransferCase(
      existing.source_department_id,
      updates.destination_department_id,
      updates.destination_faculty_id,
      updates.destination_university_id
    );
    const status: TransferItem['status'] = evaluation.caseNumber === 1 ? 'COMPLETED'
      : evaluation.caseNumber === 2 ? 'PENDING_DA_APPROVAL'
      : evaluation.caseNumber === 3 ? 'PENDING_FACULTY_APPROVAL'
      : 'PENDING_UNIVERSITY_APPROVAL';
    const updatedTransfer = { ...existing, ...updates, transfer_type: evaluation.type, status, updated_at: new Date().toISOString() };
    transfersStore = transfersStore.map(transfer => transfer.id === transferId ? updatedTransfer : transfer);
    saveToStorage(STORAGE_KEYS.TRANSFERS, transfersStore);
    return { success: true, data: updatedTransfer };
  },

  async cancelTransfer(currentUser: UserProfile, transferId: string): Promise<{ success: boolean; error?: string }> {
    const existing = transfersStore.find(transfer => transfer.id === transferId);
    if (!existing) return { success: false, error: 'Transfer not found.' };
    if (existing.requested_by !== currentUser.id) return { success: false, error: 'You can only cancel your own transfers.' };
    if (!['PENDING_APPROVAL', 'PENDING_DA_APPROVAL', 'PENDING_FACULTY_APPROVAL', 'PENDING_UNIVERSITY_APPROVAL'].includes(existing.status)) {
      return { success: false, error: 'Only pending transfers can be cancelled.' };
    }
    transfersStore = transfersStore.map(transfer => transfer.id === transferId ? { ...transfer, status: 'CANCELLED', notes: `${transfer.notes || ''} [Cancelled by requester]`.trim(), updated_at: new Date().toISOString() } : transfer);
    saveToStorage(STORAGE_KEYS.TRANSFERS, transfersStore);
    return { success: true };
  },

  // ---------------------------------------------------------------------------
  // APPROVALS (FR6)
  // ---------------------------------------------------------------------------
  // FR6 BUSINESS RULE:
  // "An administrator must see only requests that they have the privilege to approve.
  // Do NOT display every pending request to every administrator."
  async getAuthorizedPendingRequests(currentUser: UserProfile): Promise<{
    requests: RequestItem[];
    transfers: TransferItem[];
  }> {
    const allRequests = await this.getRequests();
    const allTransfers = await this.getTransfers();

    // Filter Requests
    const authorizedRequests = allRequests.filter(req => {
      if (req.status !== 'PENDING') return false;

      // Central University Admin can approve any
      if (currentUser.role_id === 'UNIVERSITY_ADMIN') return true;

      // Faculty Admin can approve within faculty
      if (currentUser.role_id === 'FACULTY_ADMIN') {
        return req.faculty_id === currentUser.faculty_id;
      }

      // Department Admin can approve within department
      if (currentUser.role_id === 'DEPARTMENT_ADMIN') {
        return req.department_id === currentUser.department_id;
      }

      // IT Admin can approve exception requests for location creation
      if (currentUser.role_id === 'IT_GROUP_MEMBER' && req.request_type === 'CREATE_LOCATION_EXCEPTION') {
        return true;
      }

      return false;
    });

    // Filter Transfers
    const authorizedTransfers = allTransfers.filter(trf => {
      // University Admin: approves Case 4 (PENDING_UNIVERSITY_APPROVAL)
      if (trf.status === 'PENDING_UNIVERSITY_APPROVAL') {
        return currentUser.role_id === 'UNIVERSITY_ADMIN' || currentUser.permissions.includes('approve_university_transfers');
      }

      // Faculty Admin: approves Case 3 or Case 2 second tier (PENDING_FACULTY_APPROVAL)
      if (trf.status === 'PENDING_FACULTY_APPROVAL') {
        return (
          currentUser.role_id === 'UNIVERSITY_ADMIN' ||
          (currentUser.role_id === 'FACULTY_ADMIN' && currentUser.faculty_id === trf.destination_faculty_id) ||
          currentUser.permissions.includes('approve_faculty_transfers')
        );
      }

      // Department Admin: approves Case 2 first tier (PENDING_DA_APPROVAL)
      if (trf.status === 'PENDING_DA_APPROVAL') {
        return (
          currentUser.role_id === 'UNIVERSITY_ADMIN' ||
          (currentUser.role_id === 'DEPARTMENT_ADMIN' && currentUser.department_id === trf.source_department_id) ||
          currentUser.permissions.includes('approve_department_transfers')
        );
      }

      return false;
    });

    return { requests: authorizedRequests, transfers: authorizedTransfers };
  },

  async approveRequest(
    currentUser: UserProfile,
    requestId: string,
    _comments?: string
  ): Promise<{ success: boolean; error?: string }> {
    const req = requestsStore.find(r => r.id === requestId);
    if (!req) return { success: false, error: 'Request not found.' };

    // Move status to WAITING FOR EXECUTION as required by SRS workflow
    requestsStore = requestsStore.map(r => 
      r.id === requestId 
        ? { ...r, status: 'WAITING_FOR_EXECUTION', updated_at: new Date().toISOString() } 
        : r
    );
    saveToStorage(STORAGE_KEYS.REQUESTS, requestsStore);

    return { success: true };
  },

  async rejectRequest(
    currentUser: UserProfile,
    requestId: string,
    comments?: string
  ): Promise<{ success: boolean; error?: string }> {
    const req = requestsStore.find(r => r.id === requestId);
    if (!req) return { success: false, error: 'Request not found.' };

    requestsStore = requestsStore.map(r => 
      r.id === requestId 
        ? { ...r, status: 'REJECTED', special_justification: comments || r.special_justification, updated_at: new Date().toISOString() } 
        : r
    );
    saveToStorage(STORAGE_KEYS.REQUESTS, requestsStore);

    return { success: true };
  },

  async approveTransfer(
    currentUser: UserProfile,
    transferId: string,
    _comments?: string
  ): Promise<{ success: boolean; error?: string }> {
    const trf = transfersStore.find(t => t.id === transferId);
    if (!trf) return { success: false, error: 'Transfer record not found.' };

    let nextStatus: TransferItem['status'] = 'COMPLETED';

    // In Case 2 (Diff Dept, Same Fac): DA approval moves to PENDING_FACULTY_APPROVAL, then Faculty approval completes
    if (trf.status === 'PENDING_DA_APPROVAL') {
      nextStatus = 'PENDING_FACULTY_APPROVAL';
    } else {
      nextStatus = 'COMPLETED';
      // Complete transfer: update asset department, faculty, and location
      assetsStore = assetsStore.map(a => {
        if (a.id === trf.asset_id) {
          return {
            ...a,
            department_id: trf.destination_department_id,
            faculty_id: trf.destination_faculty_id,
            university_id: trf.destination_university_id,
            location_id: trf.destination_location_id || a.location_id,
            status: 'AVAILABLE',
            updated_at: new Date().toISOString(),
          };
        }
        return a;
      });
      saveToStorage(STORAGE_KEYS.ASSETS, assetsStore);
    }

    transfersStore = transfersStore.map(t => 
      t.id === transferId ? { ...t, status: nextStatus, updated_at: new Date().toISOString() } : t
    );
    saveToStorage(STORAGE_KEYS.TRANSFERS, transfersStore);

    return { success: true };
  },

  async rejectTransfer(
    currentUser: UserProfile,
    transferId: string,
    comments?: string
  ): Promise<{ success: boolean; error?: string }> {
    const trf = transfersStore.find(t => t.id === transferId);
    if (!trf) return { success: false, error: 'Transfer record not found.' };

    transfersStore = transfersStore.map(t => 
      t.id === transferId ? { ...t, status: 'REJECTED', notes: comments ? `${t.notes || ''} [Rejection: ${comments}]` : t.notes, updated_at: new Date().toISOString() } : t
    );
    saveToStorage(STORAGE_KEYS.TRANSFERS, transfersStore);

    return { success: true };
  },

  // Reset local operational data without recreating user accounts.
  resetToInitialSeed(): void {
    localStorage.removeItem(STORAGE_KEYS.ASSETS);
    localStorage.removeItem(STORAGE_KEYS.LOCATIONS);
    localStorage.removeItem(STORAGE_KEYS.REQUESTS);
    localStorage.removeItem(STORAGE_KEYS.TRANSFERS);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    assetsStore = [...initialAssets];
    locationsStore = [...initialLocations];
    requestsStore = [...initialRequests];
    transfersStore = [...initialTransfers];
    usersStore = loadFromStorage(STORAGE_KEYS.USERS, []);
  }
};
