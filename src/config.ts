function requireEnv(name: string): string {
  const value = import.meta.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name} (ver .env.example).`);
  return value;
}

export const DASHBOARD_API_URL = requireEnv('VITE_DASHBOARD_API_URL');
export const COGNITO_USER_POOL_ID = requireEnv('VITE_COGNITO_USER_POOL_ID');
export const COGNITO_CLIENT_ID = requireEnv('VITE_COGNITO_CLIENT_ID');
export const COGNITO_REGION = requireEnv('VITE_COGNITO_REGION');
export const COGNITO_IDP_URL = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`;
