import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, LayoutDashboard } from 'lucide-react';
import { apiPost } from '@/lib/api';

interface CheckInResult {
  event_name: string;
  points_awarded: number;
  total_points: number;
}

type Status = 'loading' | 'success' | 'error';

export default function CheckIn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code') ?? '';

  const [status, setStatus] = useState<Status>('loading');
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!code) {
      setStatus('error');
      setErrorMsg('No check-in code provided. Please scan a valid QR code.');
      return;
    }

    apiPost<CheckInResult>('/events/checkin', { code })
      .then((res) => {
        setResult(res);
        setStatus('success');
      })
      .catch((err) => {
        setErrorMsg(err?.message ?? 'Check-in failed. The code may be invalid or expired.');
        setStatus('error');
      });
  }, [code]);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'transparent' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 flex flex-col items-center gap-6 text-center"
        style={{
          background: 'rgba(255,255,255,.04)',
          border: '1px solid rgba(185,28,28,.22)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 20px 60px rgba(0,0,0,.5)',
        }}
      >
        {status === 'loading' && (
          <>
            <Loader2 size={48} className="text-red-400 animate-spin" />
            <div>
              <h1 className="text-xl font-bold text-white font-['Oxanium']">Checking in…</h1>
              <p className="text-sm text-white/40 mt-1">Submitting code: {code}</p>
            </div>
          </>
        )}

        {status === 'success' && result && (
          <>
            <div
              className="h-20 w-20 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(21,128,61,.2)', border: '2px solid rgba(74,222,128,.3)' }}
            >
              <CheckCircle size={40} style={{ color: 'rgba(74,222,128,.9)' }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white font-['Oxanium']">Checked in!</h1>
              <p className="text-sm text-white/60 mt-1">{result.event_name}</p>
            </div>
            <div
              className="w-full rounded-xl py-4 px-6 flex flex-col items-center gap-1"
              style={{ background: 'rgba(21,128,61,.12)', border: '1px solid rgba(74,222,128,.15)' }}
            >
              <p className="text-3xl font-bold font-['Oxanium']" style={{ color: 'rgba(74,222,128,.9)' }}>
                +{result.points_awarded}
              </p>
              <p className="text-xs text-white/40">points awarded</p>
              <p className="text-xs text-white/30 mt-1">Total: {result.total_points} pts</p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-all"
              style={{ background: 'rgba(185,28,28,.6)', boxShadow: '0 0 20px rgba(185,28,28,.25)' }}
            >
              <LayoutDashboard size={14} />
              Go to Dashboard
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div
              className="h-20 w-20 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(185,28,28,.15)', border: '2px solid rgba(248,113,113,.2)' }}
            >
              <XCircle size={40} style={{ color: 'rgba(248,113,113,.8)' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white font-['Oxanium']">Check-in Failed</h1>
              <p className="text-sm text-white/50 mt-2">{errorMsg}</p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white/70 transition-all"
              style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)' }}
            >
              <LayoutDashboard size={14} />
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
