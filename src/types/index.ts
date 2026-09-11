export type RoleId = 
  | 'IT_GROUP_MEMBER'
  | 'DEPARTMENT_ADMIN'
  | 'FACULTY_ADMIN'
  | 'UNIVERSITY_ADMIN'
  | 'STANDARD_USER'
  | 'RESEARCH_STAFF';

export type UserLevel = 0 | 1 | 2 | 3;

export type PermissionCode =
  | 'view_inventory'
  | 'manage_assets'
  | 'create_locations'
  | 'create_advanced_requests'
  | 'create_exception_requests'
  | 'approve_department_transfers'
  | 'approve_faculty_transfers'
  | 'approve_university_transfers'
  | 'approve_requests'
  | 'delegate_permissions';

export interface University {
  id: string;
  name: string;
  code: string;
}

export interface Faculty {
  id: string;
  university_id: string;
  name: string;
  code: string;
}

export interface Department {
  id: string;
  faculty_id: string;
  name: string;
  code: string;
}

export interface Role {
  id: RoleId;
  name: string;
  description: string;
  default_level: UserLevel;
}

export interface Permission {
  id: PermissionCode;
  name: string;
  category: string;
  description: string;
}

export interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role_id: RoleId;
  level: UserLevel;
  department_id: string | null;
  faculty_id: string | null;
  university_id: string | null;
  department?: Department;
  faculty?: Faculty;
  university?: University;
  role?: Role;
  permissions: PermissionCode[];
}

export type AssetCondition = 'NEW' | 'GOOD' | 'FAIR' | 'DAMAGED' | 'UNDER_MAINTENANCE';
export type AssetStatus = 'AVAILABLE' | 'IN_USE' | 'TRANSFERRED' | 'RESERVED' | 'UNDER_MAINTENANCE' | 'DECOMMISSIONED';

export interface Location {
  id: string;
  name: string;
  building: string;
  room: string;
  department_id: string;
  exception_request_id?: string | null;
  created_by?: string;
  is_active: boolean;
  department?: Department;
}

export interface Asset {
  id: string; // IMMUTABLE
  name: string;
  description: string;
  category: string;
  department_id: string;
  faculty_id: string;
  university_id: string;
  location_id: string;
  condition: AssetCondition;
  status: AssetStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
  department?: Department;
  faculty?: Faculty;
  university?: University;
  location?: Location;
}

export type RequestType = 'BORROW_ASSET' | 'RESERVE_LOCATION' | 'CREATE_LOCATION_EXCEPTION';
export type FormType = 'BASIC' | 'ADVANCED' | 'EXCEPTION';
export type RequestStatus = 
  | 'PENDING'
  | 'WAITING_FOR_EXECUTION'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'COMPLETED';

export interface RequestItem {
  id: string;
  request_number: string;
  request_type: RequestType;
  form_type: FormType;
  user_id: string;
  asset_id?: string | null;
  location_id?: string | null;
  start_date: string;
  end_date: string;
  purpose: string;
  special_justification?: string;
  status: RequestStatus;
  department_id?: string | null;
  faculty_id?: string | null;
  university_id?: string | null;
  created_at: string;
  updated_at: string;
  requester?: UserProfile;
  asset?: Asset;
  location?: Location;
}

export type TransferType = 
  | 'SAME_DEPARTMENT'
  | 'DIFF_DEPT_SAME_FACULTY'
  | 'DIFF_FACULTY'
  | 'OUTSIDE_UNIVERSITY';

export type TransferStatus = 
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PENDING_APPROVAL'
  | 'PENDING_DA_APPROVAL'
  | 'PENDING_FACULTY_APPROVAL'
  | 'PENDING_UNIVERSITY_APPROVAL'
  | 'REJECTED';

export interface TransferItem {
  id: string;
  transfer_number: string;
  asset_id: string;
  source_department_id: string;
  destination_department_id: string;
  destination_faculty_id: string;
  destination_university_id: string;
  destination_location_id?: string | null;
  transfer_type: TransferType;
  status: TransferStatus;
  requested_by: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  asset?: Asset;
  source_department?: Department;
  destination_department?: Department;
  destination_faculty?: Faculty;
  destination_university?: University;
  destination_location?: Location;
  requester?: UserProfile;
  approvals?: TransferApproval[];
}

export interface TransferApproval {
  id: string;
  transfer_id: string;
  step_role: string;
  approver_id: string;
  action: 'APPROVED' | 'REJECTED';
  comments?: string;
  created_at: string;
  approver?: UserProfile;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  is_read: boolean;
  link?: string;
  created_at: string;
}
