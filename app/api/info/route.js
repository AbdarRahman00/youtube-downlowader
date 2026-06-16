import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const ytDlpPath = path.join(process.cwd(), 'yt-dlp.exe');
    const child = spawn(ytDlpPath, ['-J', '--flat-playlist', '--extractor-args', 'youtube:player_client=android', url]);
    
    const stream = new ReadableStream({
      start(controller) {
        child.stdout.on('data', (chunk) => {
          controller.enqueue(chunk);
        });

        child.stdout.on('end', () => {
          controller.close();
        });

        child.on('error', (err) => {
          console.error('Child process error:', err);
          controller.error(err);
        });

        child.stderr.on('data', (data) => {
          console.error('yt-dlp stderr:', data.toString());
        });
      },
      cancel() {
        child.kill();
      }
    });

    return new NextResponse(stream, {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'An error occurred' }, { status: 500 });
  }
}
