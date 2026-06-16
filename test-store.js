import { updateStatus, getStatusMap } from './app/api/status/store.js';

console.log('Before:', getStatusMap());
updateStatus('test1', 'processing');
console.log('After:', getStatusMap());
