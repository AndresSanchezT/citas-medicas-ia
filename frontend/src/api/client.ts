import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Los campos opcionales vacíos llegan como "" desde los formularios; el backend
  // (@IsOptional() de class-validator) solo omite la validación si la propiedad
  // está ausente, no si es "". Se eliminan aquí para que los campos opcionales
  // realmente se traten como no enviados.
  if (config.data && typeof config.data === 'object' && !(config.data instanceof FormData)) {
    for (const [key, value] of Object.entries(config.data)) {
      if (value === '') delete (config.data as Record<string, unknown>)[key];
    }
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // window.location.href fuerza una recarga completa de la página, lo que borra
      // la consola del navegador antes de que se alcance a leer el error. Se guarda
      // el detalle en sessionStorage (sobrevive a la recarga) para poder diagnosticarlo
      // después del redirect; LoginPage lo muestra al montar.
      const detalle = {
        url: `${error.config?.method?.toUpperCase() ?? ''} ${error.config?.url ?? ''}`,
        status: error.response?.status,
        body: error.response?.data,
        timestamp: new Date().toISOString(),
      };
      console.error('[auth] 401 recibido, cerrando sesión. Detalle:', detalle);
      try {
        sessionStorage.setItem('lastAuthError', JSON.stringify(detalle));
      } catch {
        /* sessionStorage no disponible (modo privado, cuota excedida, etc.); se ignora */
      }
      localStorage.removeItem('accessToken');
      localStorage.removeItem('usuario');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
