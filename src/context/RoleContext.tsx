// Backwards-compat shim: RoleContext now reads from AuthContext.
import React, { ReactNode } from 'react';
import { Role, User } from '@/types';
import { useAuth } from '@/context/AuthContext';

interface RoleContextType {
  role: Role;
  setRole: (role: Role) => void;
  currentUser: User;
}

export function RoleProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useRole(): RoleContextType {
  const { user, role, displayName } = useAuth();
  const effectiveRole: Role = role ?? 'chauffeur';
  const currentUser: User = {
    id: user?.id ?? '',
    name: displayName || user?.email || 'Användare',
    email: user?.email ?? '',
    role: effectiveRole,
    phone: '',
  };
  return {
    role: effectiveRole,
    setRole: () => {
      console.warn('Rollväxling är borttagen — roller hanteras via konto.');
    },
    currentUser,
  };
}
