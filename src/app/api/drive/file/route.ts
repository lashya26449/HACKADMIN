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

  if (!hasGoogleSheetsCredentials()) {
    return NextResponse.json(
      { error: 'Google Service Account credentials required to access Drive uploads.' },
      { status: 503 }
    );
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
    const message = error instanceof Error ? error.message : 'Drive file retrieval failed';
    return NextResponse.json({
      error: `Could not retrieve file from Google Drive: ${message}. Ensure the Google Forms upload file is shared with the service account.`,
      fileId,
    }, { status: 500 });
  }
}
