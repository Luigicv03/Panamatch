import { execSync } from 'child_process';
import path from 'path';

export async function runMigrations(): Promise<void> {
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../..'),
      env: process.env,
    });
  } catch (error) {
    console.error('Error al ejecutar migraciones:', error);
    console.warn('El servidor continuará sin ejecutar migraciones');
  }
}

export async function runSeed(): Promise<void> {
  try {
    execSync('npx tsx prisma/seed.ts', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../..'),
      env: process.env,
    });
  } catch (error) {
    console.error('Error al ejecutar seed:', error);
    console.warn('El servidor continuará sin ejecutar seed');
  }
}

