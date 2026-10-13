import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAuth } from '@/lib/firebase/server-auth';

async function handleRoleRequest(request: NextRequest) {
  const result = await verifyServerAuth(request, '/api/auth/role');
  if (!result.success) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.status }
    );
  }

  return NextResponse.json({
    role: result.user.role,
    uid: result.user.uid,
    email: result.user.email,
  });
}

export async function GET(request: NextRequest) {
  return handleRoleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRoleRequest(request);
}
