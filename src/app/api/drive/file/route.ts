import { NextRequest, NextResponse } from 'next/server';
import { getDriveClient, extractDriveFileId } from '@/lib/sheets/service';
import { hasGoogleSheetsCredentials } from '@/lib/demo-data';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawIdOrUrl = searchParams.get('id') || searchParams.get('url');

  if (!rawIdOrUrl) {
    return NextResponse.json({ error: 'Missing file ID or URL parameter' }, { status: 400 });
  }

  const fileId = extractDriveFileId(rawIdOrUrl);
  if (!fileId) {
    return NextResponse.json({ error: 'Invalid Google Drive file reference' }, { status: 400 });
  }

  const directViewUrl = `https://drive.google.com/file/d/${fileId}/view`;

  if (!hasGoogleSheetsCredentials()) {
    return NextResponse.redirect(directViewUrl);
  }

  try {
    const drive = getDriveClient();

    // 1. Fetch file metadata
    const meta = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size',
    });

    const mimeType = meta.data.mimeType || 'application/octet-stream';
    const fileName = meta.data.name || `college-id-${fileId}`;

    // 2. Fetch binary stream
    const fileStream = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    return new NextResponse(fileStream.data as unknown as ReadableStream, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    console.warn(`[DriveProxy] Direct stream failed for ${fileId}, redirecting to Google Drive web view:`, error);
    // If service account cannot access the file directly (e.g. Google Forms folder not shared with service account),
    // redirect directly to Google Drive so the organizer's browser accesses it with their active Google account.
    return NextResponse.redirect(directViewUrl);
  }
}
