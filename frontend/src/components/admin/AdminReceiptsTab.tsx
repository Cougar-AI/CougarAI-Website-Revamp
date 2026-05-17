import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, Trash2, X, Receipt, DollarSign, TrendingUp,
  ChevronDown, ImageIcon, Eye, Landmark,
} from 'lucide-react';

const BACKEND = import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:5001';

const CATEGORIES = ['Food', 'Supplies', 'Software', 'Equipment', 'Travel', 'Other'] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_COLORS: Record<Category, string> = {
  Food: 'rgba(239,68,68,.8)',
  Supplies: 'rgba(59,130,246,.8)',
  Software: 'rgba(168,85,247,.8)',
  Equipment: 'rgba(245,158,11,.8)',
  Travel: 'rgba(16,185,129,.8)',
  Other: 'rgba(156,163,175,.8)',
};

interface Fund {
  fund_id: number;
  name: string;
  description: string | null;
  budget_limit: number | null;
  fiscal_year: number;
  spent: number;
  created_at: string;
}

interface Receipt {
  receipt_id: number;
  title: string;
  vendor: string | null;
  amount: number;
  category: string | null;
  fund_id: number | null;
  fund_name: string | null;
  description: string | null;
  notes: string | null;
  receipt_image_path: string | null;
  submitted_by_email: string | null;
  created_at: string;
}

interface Stats {
  count: number;
  total_spent: number;
  month_total: number;
  by_category: { category: string; total: number }[];
  by_month: { month: string; total: number }[];
  by_fund: { fund_id: number; name: string; budget_limit: number | null; spent: number }[];
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BACKEND}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...opts.headers },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

const glass = {
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(185,28,28,.22)',
  backdropFilter: 'blur(10px)',
} as const;

// ── Fund card ──────────────────────────────────────────────────────────────────
function FundCard({ fund, onEdit, onDelete }: { fund: Fund; onEdit: () => void; onDelete: () => void }) {
  const pct = fund.budget_limit ? Math.min((fund.spent / fund.budget_limit) * 100, 100) : 0;
  const over90 = fund.budget_limit && pct >= 90;
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={glass}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-white font-semibold text-sm font-['Oxanium']">{fund.name}</div>
          <div className="text-white/40 text-xs">FY {fund.fiscal_year}</div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <Edit2 size={13} className="text-white/50" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-900/30 transition-colors">
            <Trash2 size={13} className="text-red-400/60" />
          </button>
        </div>
      </div>
      <div className="text-2xl font-bold text-white font-['Oxanium']">
        ${fund.spent.toFixed(2)}
        {fund.budget_limit && (
          <span className="text-sm font-normal text-white/40"> / ${fund.budget_limit.toFixed(2)}</span>
        )}
      </div>
      {fund.budget_limit && (
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.08)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: over90 ? 'rgba(239,68,68,.8)' : 'rgba(185,28,28,.7)',
            }}
          />
        </div>
      )}
      {fund.budget_limit && (
        <div className="text-xs" style={{ color: over90 ? 'rgba(248,113,113,.9)' : 'rgba(255,255,255,.4)' }}>
          {over90 ? `⚠ ${pct.toFixed(0)}% used` : `$${(fund.budget_limit - fund.spent).toFixed(2)} remaining`}
        </div>
      )}
      {fund.description && <div className="text-white/40 text-xs">{fund.description}</div>}
    </div>
  );
}

// ── Fund modal ─────────────────────────────────────────────────────────────────
function FundModal({ fund, onClose, onSaved }: { fund: Fund | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: fund?.name ?? '',
    description: fund?.description ?? '',
    budget_limit: fund?.budget_limit?.toString() ?? '',
    fiscal_year: fund?.fiscal_year?.toString() ?? new Date().getFullYear().toString(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true); setError('');
    try {
      const body = {
        name: form.name.trim(),
        description: form.description || null,
        budget_limit: form.budget_limit ? parseFloat(form.budget_limit) : null,
        fiscal_year: form.fiscal_year ? parseInt(form.fiscal_year) : null,
      };
      if (fund) {
        await apiFetch(`/receipts/funds/${fund.fund_id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/receipts/funds', { method: 'POST', body: JSON.stringify(body) });
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error saving fund');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.7)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4" style={{ ...glass, border: '1px solid rgba(185,28,28,.4)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold font-['Oxanium']">{fund ? 'Edit Fund' : 'New Budget Fund'}</h3>
          <button onClick={onClose}><X size={16} className="text-white/50" /></button>
        </div>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-white/60 text-xs">Fund Name *</label>
            <input className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-700"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Workshop Fund" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-white/60 text-xs">Description</label>
            <input className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-700"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-white/60 text-xs">Budget Limit ($)</label>
              <input type="number" step="0.01" min="0" className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-700"
                value={form.budget_limit} onChange={e => setForm(f => ({ ...f, budget_limit: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-white/60 text-xs">Fiscal Year</label>
              <input type="number" className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-700"
                value={form.fiscal_year} onChange={e => setForm(f => ({ ...f, fiscal_year: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white transition-colors">Cancel</button>
          <button onClick={save} disabled={saving || !form.name.trim()}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Image viewer overlay ───────────────────────────────────────────────────────
function ImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.85)' }} onClick={onClose}>
      <img src={src} alt="Receipt" className="max-h-[85vh] max-w-[85vw] rounded-xl object-contain" onClick={e => e.stopPropagation()} />
      <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20">
        <X size={20} className="text-white" />
      </button>
    </div>
  );
}

// ── Receipt modal ──────────────────────────────────────────────────────────────
function ReceiptModal({ receipt, funds, onClose, onSaved }: {
  receipt: Receipt | null; funds: Fund[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: receipt?.title ?? '',
    vendor: receipt?.vendor ?? '',
    amount: receipt?.amount?.toString() ?? '',
    category: receipt?.category ?? '',
    fund_id: receipt?.fund_id?.toString() ?? '',
    description: receipt?.description ?? '',
    notes: receipt?.notes ?? '',
    receipt_image_path: receipt?.receipt_image_path ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    receipt?.receipt_image_path ? `${BACKEND}/admin/uploads/receipts/${receipt.receipt_image_path.split('/').pop()}` : null
  );
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${BACKEND}/admin/upload-image?category=receipts`, {
        method: 'POST',
        headers: { ...authHeaders() },
        credentials: 'include',
        body: fd,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      const path = data.filename || data.url || data.path || '';
      setForm(f => ({ ...f, receipt_image_path: path }));
      setPreviewUrl(`${BACKEND}/admin/uploads/receipts/${path.split('/').pop()}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload error');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true); setError('');
    try {
      const body = {
        title: form.title.trim(),
        vendor: form.vendor || null,
        amount: parseFloat(form.amount),
        category: form.category || null,
        fund_id: form.fund_id ? parseInt(form.fund_id) : null,
        description: form.description || null,
        notes: form.notes || null,
        receipt_image_path: form.receipt_image_path || null,
      };
      if (receipt) {
        await apiFetch(`/receipts/${receipt.receipt_id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/receipts/', { method: 'POST', body: JSON.stringify(body) });
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error saving');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.7)' }}>
      <div className="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto" style={{ ...glass, border: '1px solid rgba(185,28,28,.4)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold font-['Oxanium']">{receipt ? 'Edit Receipt' : 'Add Receipt'}</h3>
          <button onClick={onClose}><X size={16} className="text-white/50" /></button>
        </div>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-white/60 text-xs">Title *</label>
            <input className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-700"
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What was purchased?" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-white/60 text-xs">Vendor / Store</label>
            <input className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-700"
              value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Where?" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-white/60 text-xs">Amount ($) *</label>
            <input type="number" step="0.01" min="0" className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-700"
              value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-white/60 text-xs">Category</label>
            <select className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-700"
              value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              <option value="">— None —</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-white/60 text-xs">Budget Fund</label>
            <select className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-700"
              value={form.fund_id} onChange={e => setForm(f => ({ ...f, fund_id: e.target.value }))}>
              <option value="">— None —</option>
              {funds.map(f => <option key={f.fund_id} value={f.fund_id}>{f.name} (FY{f.fiscal_year})</option>)}
            </select>
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-white/60 text-xs">Description</label>
            <input className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-700"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional details" />
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-white/60 text-xs">Notes</label>
            <textarea rows={2} className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-700 resize-none"
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes…" />
          </div>
          <div className="col-span-2 flex flex-col gap-2">
            <label className="text-white/60 text-xs">Receipt Photo</label>
            {previewUrl ? (
              <div className="relative w-full h-32 rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
                <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                <button onClick={() => { setPreviewUrl(null); setForm(f => ({ ...f, receipt_image_path: '' })); }}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-red-900/60">
                  <X size={12} className="text-white" />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-2 h-20 rounded-lg border-dashed border border-white/20 hover:border-red-700/50 transition-colors text-white/40 hover:text-white/60 text-sm">
                {uploading ? 'Uploading…' : <><ImageIcon size={16} /> Upload photo</>}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])} />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white transition-colors">Cancel</button>
          <button onClick={save} disabled={saving || !form.title.trim() || !form.amount}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Save Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main tab ───────────────────────────────────────────────────────────────────
export default function AdminReceiptsTab() {
  const qc = useQueryClient();
  const [showFundModal, setShowFundModal] = useState(false);
  const [editFund, setEditFund] = useState<Fund | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [editReceipt, setEditReceipt] = useState<Receipt | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterFund, setFilterFund] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const [fundsOpen, setFundsOpen] = useState(true);

  const fundsQuery = useQuery<{ funds: Fund[] }>({
    queryKey: ['receipt-funds'],
    queryFn: () => apiFetch('/receipts/funds'),
  });
  const funds = fundsQuery.data?.funds ?? [];

  const params = new URLSearchParams();
  if (filterCategory) params.set('category', filterCategory);
  if (filterFund) params.set('fund_id', filterFund);
  if (filterStart) params.set('start_date', filterStart);
  if (filterEnd) params.set('end_date', filterEnd);
  if (filterQ) params.set('q', filterQ);

  const receiptsQuery = useQuery<{ receipts: Receipt[]; total: number }>({
    queryKey: ['receipts', filterCategory, filterFund, filterStart, filterEnd, filterQ],
    queryFn: () => apiFetch(`/receipts/?${params}`),
  });
  const receipts = receiptsQuery.data?.receipts ?? [];
  const total = receiptsQuery.data?.total ?? 0;

  const statsQuery = useQuery<Stats>({
    queryKey: ['receipt-stats'],
    queryFn: () => apiFetch('/receipts/stats'),
  });
  const stats = statsQuery.data;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['receipts'] });
    qc.invalidateQueries({ queryKey: ['receipt-stats'] });
    qc.invalidateQueries({ queryKey: ['receipt-funds'] });
  };

  const deleteFund = useMutation({
    mutationFn: (id: number) => apiFetch(`/receipts/funds/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const deleteReceipt = useMutation({
    mutationFn: (id: number) => apiFetch(`/receipts/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const maxCat = Math.max(...(stats?.by_category.map(c => c.total) ?? [1]), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* Budget Funds */}
      <div className="rounded-xl p-5 flex flex-col gap-4" style={glass}>
        <div className="flex items-center justify-between">
          <button onClick={() => setFundsOpen(o => !o)}
            className="flex items-center gap-2 text-white font-semibold font-['Oxanium'] text-sm">
            <Landmark size={16} className="text-red-400" />
            Budget Funds
            <ChevronDown size={14} className={`text-white/40 transition-transform ${fundsOpen ? '' : '-rotate-90'}`} />
          </button>
          <button onClick={() => { setEditFund(null); setShowFundModal(true); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-700 hover:bg-red-800 transition-colors">
            <Plus size={13} /> New Fund
          </button>
        </div>

        {fundsOpen && (
          funds.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-4">No funds yet. Create one to track spending budgets.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {funds.map(f => (
                <FundCard key={f.fund_id} fund={f}
                  onEdit={() => { setEditFund(f); setShowFundModal(true); }}
                  onDelete={() => { if (confirm(`Delete fund "${f.name}"?`)) deleteFund.mutate(f.fund_id); }} />
              ))}
            </div>
          )
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="rounded-xl p-5 flex flex-col gap-4" style={glass}>
          <h2 className="text-white font-semibold font-['Oxanium'] text-sm flex items-center gap-2">
            <TrendingUp size={16} className="text-red-400" /> Spending Overview
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Spent', value: `$${stats.total_spent.toFixed(2)}` },
              { label: 'Receipts', value: stats.count.toString() },
              { label: 'This Month', value: `$${stats.month_total.toFixed(2)}` },
              { label: 'Top Category', value: stats.by_category[0]?.category ?? '—' },
            ].map(s => (
              <div key={s.label} className="rounded-lg p-3 text-center" style={{ background: 'rgba(255,255,255,.05)' }}>
                <div className="text-lg font-bold text-white font-['Oxanium']">{s.value}</div>
                <div className="text-white/40 text-xs">{s.label}</div>
              </div>
            ))}
          </div>

          {stats.by_category.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-white/50 text-xs font-semibold uppercase tracking-wide">By Category</div>
              {stats.by_category.map(c => (
                <div key={c.category} className="flex items-center gap-3">
                  <div className="text-white/60 text-xs w-20 shrink-0">{c.category}</div>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.08)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${(c.total / maxCat) * 100}%`,
                        background: CATEGORY_COLORS[c.category as Category] ?? 'rgba(185,28,28,.7)',
                      }} />
                  </div>
                  <div className="text-white text-xs font-medium w-20 text-right">${c.total.toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Receipts */}
      <div className="rounded-xl p-5 flex flex-col gap-4" style={glass}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-white font-semibold font-['Oxanium'] text-sm flex items-center gap-2">
            <Receipt size={16} className="text-red-400" /> Receipts
            <span className="text-white/40 font-normal text-xs">({total} total)</span>
          </h2>
          <button onClick={() => { setEditReceipt(null); setShowReceiptModal(true); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-700 hover:bg-red-800 transition-colors">
            <Plus size={13} /> Add Receipt
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <input className="bg-white/10 border border-white/15 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-red-700 w-44"
            placeholder="Search title / vendor…" value={filterQ} onChange={e => setFilterQ(e.target.value)} />
          <select className="bg-white/10 border border-white/15 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-red-700"
            value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="bg-white/10 border border-white/15 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-red-700"
            value={filterFund} onChange={e => setFilterFund(e.target.value)}>
            <option value="">All funds</option>
            {funds.map(f => <option key={f.fund_id} value={f.fund_id}>{f.name}</option>)}
          </select>
          <input type="date" className="bg-white/10 border border-white/15 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-red-700"
            value={filterStart} onChange={e => setFilterStart(e.target.value)} />
          <input type="date" className="bg-white/10 border border-white/15 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-red-700"
            value={filterEnd} onChange={e => setFilterEnd(e.target.value)} />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs uppercase tracking-wide border-b border-white/10">
                <th className="text-left py-2 font-medium">Date</th>
                <th className="text-left py-2 font-medium">Title</th>
                <th className="text-left py-2 font-medium">Vendor</th>
                <th className="text-right py-2 font-medium">Amount</th>
                <th className="text-left py-2 font-medium">Category</th>
                <th className="text-left py-2 font-medium">Fund</th>
                <th className="text-left py-2 font-medium">Photo</th>
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-white/30 text-xs">No receipts found</td></tr>
              ) : receipts.map(r => (
                <tr key={r.receipt_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-2 text-white/50 text-xs">{r.created_at.slice(0, 10)}</td>
                  <td className="py-2 text-white text-xs max-w-[140px]">
                    <div className="truncate">{r.title}</div>
                    {r.notes && <div className="text-white/30 text-xs truncate">{r.notes}</div>}
                  </td>
                  <td className="py-2 text-white/60 text-xs">{r.vendor ?? '—'}</td>
                  <td className="py-2 text-white font-medium text-xs text-right">${r.amount.toFixed(2)}</td>
                  <td className="py-2">
                    {r.category ? (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        background: `${CATEGORY_COLORS[r.category as Category] ?? 'rgba(255,255,255,.1)'}22`,
                        color: CATEGORY_COLORS[r.category as Category] ?? 'rgba(255,255,255,.6)',
                        border: `1px solid ${CATEGORY_COLORS[r.category as Category] ?? 'rgba(255,255,255,.1)'}44`,
                      }}>{r.category}</span>
                    ) : <span className="text-white/30 text-xs">—</span>}
                  </td>
                  <td className="py-2 text-white/50 text-xs">{r.fund_name ?? '—'}</td>
                  <td className="py-2">
                    {r.receipt_image_path ? (
                      <button onClick={() => setViewImage(`${BACKEND}/admin/uploads/receipts/${r.receipt_image_path!.split('/').pop()}`)}
                        className="p-1 rounded hover:bg-white/10 transition-colors">
                        <Eye size={14} className="text-blue-400" />
                      </button>
                    ) : <span className="text-white/20 text-xs">—</span>}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditReceipt(r); setShowReceiptModal(true); }}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                        <Edit2 size={13} className="text-white/50" />
                      </button>
                      <button onClick={() => { if (confirm(`Delete receipt "${r.title}"?`)) deleteReceipt.mutate(r.receipt_id); }}
                        className="p-1.5 rounded-lg hover:bg-red-900/30 transition-colors">
                        <Trash2 size={13} className="text-red-400/60" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Spending by fund (stats) */}
      {stats && stats.by_fund.length > 0 && (
        <div className="rounded-xl p-5 flex flex-col gap-3" style={glass}>
          <h2 className="text-white font-semibold font-['Oxanium'] text-sm flex items-center gap-2">
            <DollarSign size={16} className="text-red-400" /> Fund Utilization
          </h2>
          {stats.by_fund.map(f => {
            const pct = f.budget_limit ? Math.min((f.spent / f.budget_limit) * 100, 100) : 0;
            return (
              <div key={f.fund_id} className="flex items-center gap-3">
                <div className="text-white/60 text-xs w-32 shrink-0 truncate">{f.name}</div>
                {f.budget_limit ? (
                  <>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.08)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: pct >= 90 ? 'rgba(239,68,68,.8)' : 'rgba(185,28,28,.7)' }} />
                    </div>
                    <div className="text-white text-xs w-32 text-right">
                      ${f.spent.toFixed(2)} / ${f.budget_limit.toFixed(2)}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 text-white/40 text-xs">${f.spent.toFixed(2)} spent (no limit)</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showFundModal && (
        <FundModal fund={editFund} onClose={() => setShowFundModal(false)}
          onSaved={() => { setShowFundModal(false); invalidate(); }} />
      )}
      {showReceiptModal && (
        <ReceiptModal receipt={editReceipt} funds={funds} onClose={() => setShowReceiptModal(false)}
          onSaved={() => { setShowReceiptModal(false); invalidate(); }} />
      )}
      {viewImage && <ImageModal src={viewImage} onClose={() => setViewImage(null)} />}
    </div>
  );
}
