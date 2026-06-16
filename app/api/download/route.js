import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { updateStatus } from '../status/store';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const title = searchParams.get('title') || 'video';
    const vidId = searchParams.get('vidId');

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    if (vidId) {
      updateStatus(vidId, 'processing');
    }

    const ytDlpPath = path.join(process.cwd(), 'yt-dlp.exe');

    // Spawn yt-dlp to output to stdout
    // -f best ensures a single file with both video and audio is downloaded (no ffmpeg needed)
    // -o - outputs to stdout
    const ytDlpProcess = spawn(ytDlpPath, ['-f', 'best', '--extractor-args', 'youtube:player_client=android', '-o', '-', url]);

    const stream = new ReadableStream({
      start(controller) {
        let isClosed = false;

        ytDlpProcess.stdout.on('data', (chunk) => {
          if (isClosed) return;
          try {
            controller.enqueue(chunk);
          } catch (e) {
            isClosed = true;
            if (vidId) updateStatus(vidId, 'done');
          }
        });

        ytDlpProcess.on('close', (code) => {
          if (code !== 0) {
            console.error(`yt-dlp exited with code ${code}`);
          }
          if (vidId) updateStatus(vidId, 'done');
          
          if (!isClosed) {
            try {
              controller.close();
            } catch (e) {}
            isClosed = true;
          }
        });

        ytDlpProcess.stderr.on('data', (chunk) => {
          console.error(`yt-dlp stderr: ${chunk}`);
        });

        ytDlpProcess.on('error', (err) => {
          console.error(`yt-dlp error:`, err);
          if (vidId) updateStatus(vidId, 'error');
          if (!isClosed) {
            try {
              controller.error(err);
            } catch (e) {}
            isClosed = true;
          }
        });
      },
      cancel() {
        if (vidId) updateStatus(vidId, 'done');
        ytDlpProcess.kill();
      }
    });

    const headers = new Headers();
    // Use the title from the query params for the filename
    // Replace non-ascii or problematic characters to prevent header errors
    const safeTitle = title.replace(/[^a-zA-Z0-9 ]/g, "").trim() || 'download';
    headers.set('Content-Disposition', `attachment; filename="${safeTitle}.mp4"`);
    headers.set('Content-Type', 'video/mp4');

    return new NextResponse(stream, { headers });
  } catch (error) {
    console.error('Download API Error:', error);
    return NextResponse.json({ error: error.message || 'An error occurred' }, { status: 500 });
  }
}
