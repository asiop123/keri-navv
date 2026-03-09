import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Role, User } from '@/types';
import { mockUsers } from '@/data/mockData';

interface RoleContextType {
  role: Role;
  setRole: (role: Role) => void;
  currentUser: User;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('chef');
  const currentUser = role === 'chef' ? mockUsers[0] : mockUsers[1];

  return (
    <RoleContext.Provider value={{ role, setRole, currentUser }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) throw new Error('useRole must be used within RoleProvider');
  return context;
}
