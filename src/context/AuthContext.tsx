import React, { useState, useEffect } from 'react';
import { UserProfile, PermissionCode } from '../types';
import { api } from '../services/api';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthContext } from './auth-context';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize session on mount
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      try {
        if (isSupabaseConfigured) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const profile = await api.getUserById(session.user.id);
            if (profile) {
              setUser(profile);
              setIsLoading(false);
              return;
            }
          }
        }

        setUser(null);
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (usernameOrEmail: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const cleanInput = usernameOrEmail.trim().toLowerCase();

      // If live Supabase is configured and has credentials
      if (isSupabaseConfigured) {
        const loginEmail = cleanInput.includes('@')
          ? cleanInput
          : await api.getEmailByUsername(cleanInput);

        if (!loginEmail) {
          setIsLoading(false);
          return { success: false, error: 'No account was found for that username.' };
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: password,
        });

        if (error) {
          setIsLoading(false);
          return { success: false, error: error.message };
        }

        if (data.user) {
          const profile = await api.getUserById(data.user.id);
          if (profile) {
            setUser(profile);
            setIsLoading(false);
            return { success: true };
          }
          setIsLoading(false);
          return { success: false, error: 'Your account is authenticated, but its profile is missing. Run supabase/migration_current_schema.sql in Supabase SQL Editor.' };
        }
      }

      if (isSupabaseConfigured) {
        setIsLoading(false);
        return { success: false, error: 'Invalid username/email or password.' };
      }

      setIsLoading(false);
      return { success: false, error: 'Supabase is not configured. Configure the application before signing in.' };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err.message || 'Login failed due to unexpected error.' };
    }
  };

  const register = async ({ fullName, username, email, password }: { fullName: string; username: string; email: string; password: string }) => {
    setIsLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanUsername = username.trim().toLowerCase();

      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { full_name: fullName.trim(), username: cleanUsername } },
        });
        if (error) return { success: false, error: error.message };
        if (!data.session) return { success: true, requiresConfirmation: true };
        let profile = await api.getUserById(data.user!.id);
        if (!profile && data.user) {
          await api.ensureSupabaseProfile({
            id: data.user.id,
            username: cleanUsername,
            full_name: fullName.trim(),
            email: cleanEmail,
          });
          profile = await api.getUserById(data.user.id);
        }
        if (profile) {
          setUser(profile);
          return { success: true };
        }
        return { success: false, error: 'Account created, but its profile could not be loaded.' };
      }

      return { success: false, error: 'Supabase is not configured. Configure the application before registering.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration failed.' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setIsLoading(false);
  };

  const hasPermission = (perm: PermissionCode): boolean => {
    if (!user) return false;
    return user.permissions.includes(perm);
  };

  const refreshUser = async () => {
    if (user) {
      const refreshed = await api.getUserById(user.id);
      if (refreshed) {
        setUser(refreshed);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        hasPermission,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
