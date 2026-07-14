import { useState, useRef } from 'react';
import { X, Link, Download } from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import type { Event } from './events.types';

const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL ?? 'http://localhost:5173';

export default function QRPresentModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const checkInUrl = `${FRONTEND_URL}/checkin?code=${event.check_in_code}`;
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  function copyUrl() {
    navigator.clipboard.writeText(checkInUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyCode() {
    navigator.clipboard.writeText(event.check_in_code!);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${event.name.replace(/[^a-z0-9]/gi, '-')}.png`;
    a.click();
  }

  function downloadSvg() {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${event.name.replace(/[^a-z0-9]/gi, '-')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const logoSettings = { src: '/logo.png', height: 56, width: 56, excavate: true };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.92)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-3xl p-8 flex flex-col items-center gap-6"
        style={{ background: 'rgba(10,0,0,.97)', border: '1px solid rgba(185,28,28,.4)', boxShadow: '0 40px 120px rgba(0,0,0,.8)' }}
      >
        <div className="flex items-center justify-between w-full">
          <div>
            <h2 className="text-xl font-bold text-white font-['Oxanium']">{event.name}</h2>
            <p className="text-xs text-white/40 mt-0.5">Scan to check in</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors"><X size={20} /></button>
        </div>

        {/* Large QR for display */}
        <div className="rounded-2xl p-5" style={{ background: '#fff' }}>
          <QRCodeSVG
            ref={svgRef}
            value={checkInUrl}
            size={360}
            level="H"
            includeMargin={false}
            imageSettings={logoSettings}
          />
        </div>

        {/* Hidden canvas for PNG download */}
        <div className="sr-only">
          <QRCodeCanvas
            ref={canvasRef}
            value={checkInUrl}
            size={600}
            level="H"
            includeMargin={false}
            imageSettings={logoSettings}
          />
        </div>

        {/* Code display — click to copy */}
        <button
          onClick={copyCode}
          title="Click to copy code"
          className="text-2xl font-mono tracking-[0.25em] px-5 py-2 rounded-xl transition-all cursor-pointer"
          style={codeCopied
            ? { background: 'rgba(21,128,61,.2)', color: 'rgba(74,222,128,.9)' }
            : { background: 'rgba(185,28,28,.2)', color: 'rgba(248,113,113,.9)' }}
        >
          {codeCopied ? 'Copied!' : event.check_in_code}
        </button>

        {/* URL */}
        <p className="text-xs text-white/25 truncate max-w-full px-2">{checkInUrl}</p>

        {/* Actions */}
        <div className="flex items-center gap-2 w-full">
          <button
            onClick={copyUrl}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all"
            style={copied
              ? { background: 'rgba(21,128,61,.2)', color: 'rgba(74,222,128,.8)', border: '1px solid rgba(74,222,128,.2)' }
              : { background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.7)', border: '1px solid rgba(255,255,255,.08)' }}
          >
            <Link size={13} />
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <button
            onClick={downloadPng}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm transition-all"
            style={{ background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.7)', border: '1px solid rgba(255,255,255,.08)' }}
            title="Download PNG"
          >
            <Download size={13} /> PNG
          </button>
          <button
            onClick={downloadSvg}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm transition-all"
            style={{ background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.7)', border: '1px solid rgba(255,255,255,.08)' }}
            title="Download SVG"
          >
            <Download size={13} /> SVG
          </button>
        </div>
      </div>
    </div>
  );
}
