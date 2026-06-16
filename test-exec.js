const { exec } = require('child_process');
exec('"c:\\Users\\AR\\Desktop\\youtube downlowader\\yt-dlp.exe" -J --flat-playlist "https://www.youtube.com/watch?v=dQw4w9WgXcQ"', (err, stdout, stderr) => {
  console.log("ERR:", err?.message);
});
