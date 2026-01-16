
import React, { useEffect, useRef, useState } from 'react';

interface CameraFeedProps {
  onCapture?: (base64: string) => void;
  isCapturing?: boolean;
}

const CameraFeed: React.FC<CameraFeedProps> = ({ onCapture, isCapturing }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' }, 
          audio: false 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError("SENSOR_INIT_FAILED");
        console.error(err);
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Effect untuk menangkap gambar saat diminta
  useEffect(() => {
    if (isCapturing && videoRef.current && onCapture) {
      const captureFrame = () => {
        const video = videoRef.current;
        if (!video || video.readyState !== 4) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL('image/jpeg', 0.5);
          onCapture(base64);
        }
      };

      // Beri jeda sedikit agar kamera stabil sebelum capture
      const timer = setTimeout(captureFrame, 1500);
      return () => clearTimeout(timer);
    }
  }, [isCapturing, onCapture]);

  return (
    <div className="relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden rounded-lg border border-slate-800">
      {error ? (
        <div className="text-[10px] text-rose-500 mono flex flex-col items-center gap-2">
          <i className="fas fa-exclamation-triangle text-lg"></i>
          <span>{error}</span>
        </div>
      ) : (
        <>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted
            className="w-full h-full object-cover opacity-60 grayscale brightness-125 contrast-125"
          />
          
          <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="bg-slate-900/80 px-2 py-1 border border-slate-700 rounded flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></div>
                <span className="text-[8px] font-bold text-slate-300 tracking-tighter uppercase">OPTICAL_LINK_LIVE</span>
              </div>
              <div className="text-[8px] text-blue-400 mono">
                AUTO_SYNC: ON
              </div>
            </div>
            
            <div className="flex justify-center">
              <div className="w-16 h-16 border border-blue-500/20 rounded-full flex items-center justify-center border-dashed animate-spin-slow">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              </div>
            </div>

            <div className="flex justify-between items-end">
              <div className="text-[8px] text-slate-500 mono">
                B-REC: READY<br/>
                M-CAL: OK
              </div>
              <div className="bg-blue-500/20 px-2 py-1 rounded text-[8px] text-blue-300 font-bold border border-blue-500/30">
                LENS_VERIFIED
              </div>
            </div>
          </div>

          <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]"></div>
        </>
      )}
    </div>
  );
};

export default CameraFeed;
