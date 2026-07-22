import { createContext, useContext, useState, type ReactNode } from 'react';
import { login as loginRequest, type Usuario } from '../api/auth';

interface AuthContextValue {
  usuario: Usuario | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<Usuario>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): Usuario | null {
  const raw = localStorage.getItem('usuario');
  return raw ? (JSON.parse(raw) as Usuario) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(readStoredUser());

  async function login(email: string, password: string) {
    const { accessToken, usuario: user } = await loginRequest(email, password);
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('usuario', JSON.stringify(user));
    setUsuario(user);
    return user;
  }

  function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('usuario');
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, isAuthenticated: !!usuario, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
