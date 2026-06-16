import fs from 'fs';
import path from 'path';

const statusFile = path.join(process.cwd(), 'download-status.json');

export function getStatusMap() {
  try {
    if (fs.existsSync(statusFile)) {
      return JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading status map', e);
  }
  return {};
}

export function updateStatus(id, status) {
  try {
    const map = getStatusMap();
    map[id] = status;
    fs.writeFileSync(statusFile, JSON.stringify(map, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing status map', e);
  }
}
