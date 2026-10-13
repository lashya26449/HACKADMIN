import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App;

export function getFirebaseAdminConfig() {
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    'hackadmin-493cb';

  const clientEmail =
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  const rawKey =
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  const privateKey = rawKey
    ? rawKey
        .trim()
        .replace(/^["']|["']$/g, '') // strip surrounding quotes from Vercel UI
        .replace(/\\n/g, '\n')
        .replace(/\r/g, '')
    : undefined;

  return { projectId, clientEmail, privateKey };
}

function getAdminApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }

  const { projectId, clientEmail, privateKey } = getFirebaseAdminConfig();

  if (!projectId || !clientEmail || !privateKey) {
    const missing: string[] = [];
    if (!projectId) missing.push('FIREBASE_ADMIN_PROJECT_ID');
    if (!clientEmail) missing.push('FIREBASE_ADMIN_CLIENT_EMAIL (or GOOGLE_SERVICE_ACCOUNT_EMAIL)');
    if (!privateKey) missing.push('FIREBASE_ADMIN_PRIVATE_KEY (or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)');
    throw new Error(`Firebase Admin credentials are not configured. Missing: ${missing.join(', ')}`);
  }

  adminApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    projectId,
  });

  return adminApp;
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp());
}
