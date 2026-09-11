import { createContext } from 'react';
import { UserProfile, PermissionCode } from '../types';

export interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: { fullName: string; username: string; email: string; password: string }) => Promise<{ success: boolean; error?: string; requiresConfirmation?: boolean }>;
  logout: () => Promise<void>;
  hasPermission: (perm: PermissionCode) => boolean;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const CURRENT_USER_KEY = 'ams_current_user_id';
