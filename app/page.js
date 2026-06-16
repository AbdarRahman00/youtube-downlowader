'use client';

import { useState, useEffect } from 'react';
import './globals.css';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [selectedVideos, setSelectedVideos] = useState(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadedVideos, setDownloadedVideos] = useState(new Set());
  const [processingVideos, setProcessingVideos] = useState(new Set());
  const [downloadQueue, setDownloadQueue] = useState([]);
  const [concurrentLimit, setConcurrentLimit] = useState(10);

  useEffect(() => {
    let interval;
    if (processingVideos.size > 0) {
      interval = setInterval(async () => {
        try {
          const ids = Array.from(processingVideos).join(',');
          const res = await fetch(`/api/status?ids=${encodeURIComponent(ids)}`);
          if (!res.ok) return;
          const statusMap = await res.json();
          
          let updated = false;
          const newProcessing = new Set(processingVideos);
          const newDownloaded = new Set(downloadedVideos);
          
          for (const [id, status] of Object.entries(statusMap)) {
            if (status === 'done') {
              newProcessing.delete(id);
              newDownloaded.add(id);
              updated = true;
            } else if (status === 'error') {
              newProcessing.delete(id);
              updated = true;
            }
          }
          
          if (updated) {
            setProcessingVideos(newProcessing);
            setDownloadedVideos(newDownloaded);
          }
        } catch (err) {
          console.error('Failed to poll status', err);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [processingVideos, downloadedVideos]);

  useEffect(() => {
    // Queue processor: limit to concurrentLimit concurrent downloads
    if (processingVideos.size < concurrentLimit && downloadQueue.length > 0) {
      const toStart = downloadQueue.slice(0, concurrentLimit - processingVideos.size);
      const remaining = downloadQueue.slice(toStart.length);
      
      const newProcessing = new Set(processingVideos);
      
      toStart.forEach((item) => {
        const { downloadUrl, title, vidId } = item;
        newProcessing.add(vidId);
        
        const url = `/api/download?url=${encodeURIComponent(downloadUrl)}&title=${encodeURIComponent(title)}&vidId=${encodeURIComponent(vidId)}`;
        const a = document.createElement('a');
        a.href = url;
        a.setAttribute('download', '');
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
      
      setProcessingVideos(newProcessing);
      setDownloadQueue(remaining);
    }
  }, [processingVideos.size, downloadQueue, concurrentLimit]);

  const fetchInfo = async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    setDownloadSuccess(false);

    try {
      const res = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      
      setInfo(data);
      
      let allVideoIds = [];
      if (data._type === 'playlist') {
        allVideoIds = data.entries.map(v => v.url || v.id).filter(Boolean);
      } else {
        allVideoIds = [data.webpage_url || data.id].filter(Boolean);
      }

      if (data._type === 'playlist') {
        setSelectedVideos(new Set(allVideoIds.filter(id => !downloadedVideos.has(id))));
      } else {
        setSelectedVideos(new Set(allVideoIds.filter(id => !downloadedVideos.has(id))));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVideo = (vidUrl) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(vidUrl)) {
      newSelected.delete(vidUrl);
    } else {
      newSelected.add(vidUrl);
    }
    setSelectedVideos(newSelected);
  };

  const getSelectableVideos = () => {
    if (!info || info._type !== 'playlist') return [];
    const allVideoIds = info.entries.map(v => v.url || v.id).filter(Boolean);
    return allVideoIds.filter(id => {
      const isDownloaded = downloadedVideos.has(id);
      const isProcessing = processingVideos.has(id);
      const isQueued = downloadQueue.some(item => item.vidId === id);
      return !isDownloaded && !isProcessing && !isQueued;
    });
  };

  const handleToggleAll = () => {
    const selectable = getSelectableVideos();
    if (selectedVideos.size === selectable.length && selectable.length > 0) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(selectable));
    }
  };

  const selectN = (n) => {
    const selectable = getSelectableVideos();
    setSelectedVideos(new Set(selectable.slice(0, n)));
  };

  const startDownload = () => {
    if (selectedVideos.size === 0) return;
    setDownloading(true);
    setDownloadSuccess(false);

    const newItems = Array.from(selectedVideos).map((vidId) => {
      const downloadUrl = vidId.startsWith('http') ? vidId : `https://youtube.com/watch?v=${vidId}`;
      let title = 'video';
      if (info) {
        if (info._type === 'playlist') {
          const entry = info.entries?.find(e => (e.url || e.id) === vidId);
          if (entry) title = entry.title;
        } else {
          title = info.title;
        }
      }
      return { downloadUrl, title, vidId };
    });

    setDownloadQueue(prev => [...prev, ...newItems]);
    setSelectedVideos(new Set());
    setDownloading(false);
    setDownloadSuccess(true);
  };

  return (
    <main style={{ padding: '40px 20px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '10px', background: 'linear-gradient(to right, var(--primary), var(--accent))', WebkitBackgroundClip: 'text', color: 'transparent' }}>
          YT Downloader
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1.2rem' }}>
          Download single videos or entire channels directly to your PC.
        </p>
      </div>

      <div className="glass" style={{ padding: '30px', marginBottom: '30px', display: 'flex', gap: '15px', alignItems: 'center' }}>
        <input 
          type="text" 
          className="input-field" 
          placeholder="Paste YouTube Video or Channel Link here..." 
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchInfo()}
        />
        <button 
          className="btn-primary" 
          onClick={fetchInfo}
          disabled={loading || !url}
          style={{ whiteSpace: 'nowrap', minWidth: '120px' }}
        >
          {loading ? <span className="loader"></span> : 'Get Info'}
        </button>
      </div>

      {error && (
        <div className="glass" style={{ padding: '20px', color: '#f87171', borderLeft: '4px solid #ef4444', marginBottom: '30px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {info && (
        <div className="glass" style={{ padding: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.5rem' }}>
              {info._type === 'playlist' ? `Channel: ${info.title} (${info.entries?.length || 0} videos)` : `Video: ${info.title}`}
            </h2>
            
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {info._type === 'playlist' && (
                <>
                  <button 
                    className="btn-primary" 
                    onClick={() => selectN(10)}
                    style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', color: 'white', padding: '8px 12px', fontSize: '0.9rem' }}
                  >
                    +10
                  </button>
                  <button 
                    className="btn-primary" 
                    onClick={() => selectN(30)}
                    style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', color: 'white', padding: '8px 12px', fontSize: '0.9rem' }}
                  >
                    +30
                  </button>
                  <button 
                    className="btn-primary" 
                    onClick={handleToggleAll}
                    style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', color: 'white', padding: '8px 12px', fontSize: '0.9rem' }}
                  >
                    Select All
                  </button>
                  <button 
                    className="btn-primary" 
                    onClick={() => setSelectedVideos(new Set())}
                    style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', boxShadow: 'none', padding: '8px 12px', fontSize: '0.9rem' }}
                  >
                    Clear
                  </button>
                </>
              )}
              <button 
                className="btn-primary" 
                onClick={startDownload}
                disabled={downloading || selectedVideos.size === 0}
              >
                {downloading ? 'Starting...' : `Download Selected (${selectedVideos.size})`}
              </button>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <span style={{ color: '#cbd5e1' }}>Concurrent Limit:</span>
            <select 
              className="input-field" 
              style={{ width: 'auto', padding: '5px 10px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'white', borderRadius: '8px' }}
              value={concurrentLimit}
              onChange={(e) => setConcurrentLimit(parseInt(e.target.value, 10))}
            >
              <option value="5" style={{ color: 'black' }}>5</option>
              <option value="10" style={{ color: 'black' }}>10</option>
              <option value="15" style={{ color: 'black' }}>15</option>
              <option value="20" style={{ color: 'black' }}>20</option>
              <option value="30" style={{ color: 'black' }}>30</option>
            </select>
          </div>

          {downloadSuccess && (
            <div style={{ padding: '15px', background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', borderRadius: '8px', marginBottom: '20px' }}>
              Downloads started! Check your browser's download manager.
            </div>
          )}

          {info._type === 'playlist' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
              {info.entries?.map((v, i) => {
                const vidUrl = v.url || v.id;
                const isSelected = selectedVideos.has(vidUrl);
                const isDownloaded = downloadedVideos.has(vidUrl);
                const isProcessing = processingVideos.has(vidUrl);
                const isQueued = downloadQueue.some(item => item.vidId === vidUrl);
                const isDisabled = isDownloaded || isProcessing || isQueued;
                return (
                  <div key={i} className="glass" style={{ padding: '15px', cursor: isDisabled ? 'not-allowed' : 'pointer', border: isSelected ? '2px solid var(--primary)' : '2px solid transparent', opacity: isDownloaded ? 0.5 : (isDisabled ? 0.7 : 1) }} onClick={() => !isDisabled && handleToggleVideo(vidUrl)}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <input 
                        type="checkbox" 
                        checked={isSelected || isDisabled}
                        disabled={isDisabled}
                        onChange={() => {}} 
                        style={{ marginTop: '5px', accentColor: isDownloaded ? '#4ade80' : (isProcessing ? '#fbbf24' : (isQueued ? '#60a5fa' : 'var(--primary)')), transform: 'scale(1.2)' }}
                      />
                      <span style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                        {v.title} 
                        {isDownloaded && <span style={{color: '#4ade80', fontSize: '0.8rem', fontWeight: 'bold', marginLeft: '5px'}}>(Downloaded)</span>}
                        {isProcessing && <span style={{color: '#fbbf24', fontSize: '0.8rem', fontWeight: 'bold', marginLeft: '5px'}}>(Processing...)</span>}
                        {isQueued && <span style={{color: '#60a5fa', fontSize: '0.8rem', fontWeight: 'bold', marginLeft: '5px'}}>(In Queue...)</span>}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              {info.thumbnail && <img src={info.thumbnail} alt={info.title} style={{ width: '250px', borderRadius: '8px' }} />}
              <div>
                <p style={{ color: '#cbd5e1', marginBottom: '10px' }}>Duration: {Math.floor(info.duration / 60)}:{info.duration % 60}</p>
                <p style={{ color: '#cbd5e1' }}>Uploader: {info.uploader}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
