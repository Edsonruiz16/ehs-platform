import dotenv from 'dotenv';

dotenv.config();

function required(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variable de entorno faltante: ${key}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/ehs_platform'),
  jwtSecret: required('JWT_SECRET', 'dev_secret_change_me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@ehs.local',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123*',
};
