import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    
    const db = getAdminFirestore();
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    
    let role = 'readonly_viewer';
    if (userDoc.exists) {
      role = userDoc.data()?.role ?? 'readonly_viewer';
    }

    return NextResponse.json({ role, uid: decoded.uid, email: decoded.email });
  } catch (error) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }
}
