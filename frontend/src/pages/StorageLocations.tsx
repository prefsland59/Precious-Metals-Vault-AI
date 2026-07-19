import { useState, useEffect, useCallback } from 'react';
import { api, type StorageLocationDetail } from '../lib/api';
import type { StorageLocation, LocationType } from '@pmvault/shared';
import { LOCATION_TYPE_LABELS, LOCATION_TYPE_ICONS } from '@pmvault/shared';

// ─── Helpers ─────────────────────────────────────────────────────
const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const fmtOz = (n: number) => `${n.toFixed(2)} oz`;

const LOCATION_TYPES: LocationType[] = ['home', 'bank_vault', 'private_vault', 'safe', 'other'];

// ─── Form Data ───────────────────────────────────────────────────
interface LocationFormData {
  name: string;
  description: string;
  type: LocationType;
  insuranceCoverage: string;
  notes: string;
}

const emptyForm: LocationFormData = {
  name: '',
  description: '',
  type: 'home',
  insuranceCoverage: '',
  notes: '',
};

// ═══════════════════════════════════════════════════════════════════
//  StorageLocationsPage
// ═══════════════════════════════════════════════════════════════════
export function StorageLocationsPage() {
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [details, setDetails] = useState<Map<string, StorageLocationDetail>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LocationFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<StorageLocationDetail | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ─── Fetch data ──────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const locs = await api.get<StorageLocation[]>('/api/storage-locations');
      setLocations(locs);

      // Fetch detail for each location (parallel)
      const detailResults = await Promise.all(
        locs.map((loc) =>
          api.get<StorageLocationDetail>(`/api/storage-locations/${loc.id}`).catch(() => null)
        )
      );

      const detailMap = new Map<string, StorageLocationDetail>();
      detailResults.forEach((d, i) => {
        if (d) detailMap.set(locs[i].id, d);
      });
      setDetails(detailMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load storage locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Toast auto-dismiss ──────────────────────────────────────
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // ─── Open Add Modal ─────────────────────────────────────────
  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormErrors({});
    setModalOpen(true);
  };

  // ─── Open Edit Modal ────────────────────────────────────────
  const openEdit = (loc: StorageLocation) => {
    setEditingId(loc.id);
    setForm({
      name: loc.name,
      description: loc.description || '',
      type: loc.type,
      insuranceCoverage: loc.insuranceCoverage ? String(loc.insuranceCoverage) : '',
      notes: loc.notes || '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  // ─── Close Modal ────────────────────────────────────────────
  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormErrors({});
  };

  // ─── Validate Form ──────────────────────────────────────────
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (form.insuranceCoverage && (isNaN(Number(form.insuranceCoverage)) || Number(form.insuranceCoverage) < 0)) {
      errs.insuranceCoverage = 'Must be a valid amount';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ─── Submit Form ────────────────────────────────────────────
  const submitForm = async () => {
    if (!validate()) return;
    setSaving(true);

    const body = {
      name: form.name.trim(),
      description: form.description.trim(),
      type: form.type,
      insuranceCoverage: form.insuranceCoverage ? Number(form.insuranceCoverage) : 0,
      notes: form.notes.trim(),
    };

    try {
      if (editingId) {
        await api.put<StorageLocation>(`/api/storage-locations/${editingId}`, body);
        setToast({ type: 'success', message: 'Location updated!' });
      } else {
        await api.post<StorageLocation>('/api/storage-locations', body);
        setToast({ type: 'success', message: 'Location created!' });
      }
      closeModal();
      await fetchData();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save location' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete Location ────────────────────────────────────────
  const confirmDelete = async (locId: string) => {
    // First, fetch detail to check holdings
    try {
      const detail = await api.get<StorageLocationDetail>(`/api/storage-locations/${locId}`);
      if (detail.holdings.length > 0) {
        setDeleteBlocked(detail.holdings.map((h) => h.name));
        setDeleteTarget(detail);
        return;
      }
      setDeleteBlocked(null);
      setDeleteTarget(detail);
    } catch {
      // If we can't fetch detail, just try deleting
      setDeleteBlocked(null);
      setDeleteTarget({ id: locId } as StorageLocationDetail);
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget || deleteBlocked) return;
    setDeleting(true);
    try {
      await api.delete<{ deleted: boolean }>(`/api/storage-locations/${deleteTarget.id}`);
      setToast({ type: 'success', message: 'Location deleted!' });
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to delete location' });
    } finally {
      setDeleting(false);
    }
  };

  // ─── Update form field ─────────────────────────────────────
  const updateField = (field: keyof LocationFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // ═══════════════════════════════════════════════════════════════
  //  Render
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="p-8">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-semibold text-platinum">Vaults</h2>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-gold/20 text-gold border border-gold/30 rounded-lg hover:bg-gold/30 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <span>+</span>
          Add Location
        </button>
      </div>
      <p className="text-silver-dark mb-8">Manage your storage locations and insurance coverage</p>

      {/* ─── Toast ─────────────────────────────────────────── */}
      {toast && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg border text-sm flex items-start gap-3 animate-fade-in ${
            toast.type === 'success'
              ? 'border-green-700/50 bg-green-900/20 text-green-300'
              : 'border-red-700/50 bg-red-900/20 text-red-300'
          }`}
        >
          <span className="text-lg">{toast.type === 'success' ? '✓' : '✗'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* ─── Loading State ────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-charcoal border border-charcoal-light rounded-lg p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-charcoal-light rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 bg-charcoal-light rounded w-24 mb-2" />
                  <div className="h-3 bg-charcoal-light rounded w-16" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-6 bg-charcoal-light rounded w-20" />
                <div className="h-4 bg-charcoal-light rounded w-32" />
                <div className="h-3 bg-charcoal-light rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Error State ──────────────────────────────────── */}
      {error && !loading && (
        <div className="bg-charcoal border border-red-800/40 rounded-lg p-8 text-center max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-full bg-red-900/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-medium text-platinum mb-2">Unable to Load Locations</h3>
          <p className="text-silver-dark text-sm mb-6">{error}</p>
          <button
            onClick={fetchData}
            className="px-5 py-2 bg-gold/20 text-gold border border-gold/30 rounded-lg hover:bg-gold/30 transition-colors text-sm font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* ─── Empty State ──────────────────────────────────── */}
      {!loading && !error && locations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mb-6">
            <span className="text-2xl">🔒</span>
          </div>
          <h3 className="text-xl font-medium text-platinum mb-2">No Storage Locations Yet</h3>
          <p className="text-silver-dark max-w-md mb-6">
            Create a storage location to organize your precious metals portfolio. Track what's stored where and monitor insurance coverage.
          </p>
          <button
            onClick={openAdd}
            className="px-5 py-2.5 bg-gold text-black font-semibold rounded-lg hover:bg-gold-light transition-colors text-sm"
          >
            Add Your First Location
          </button>
        </div>
      )}

      {/* ─── Location Cards Grid ──────────────────────────── */}
      {!loading && !error && locations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((loc) => {
            const detail = details.get(loc.id);
            const icon = LOCATION_TYPE_ICONS[loc.type] || '📦';
            const typeLabel = LOCATION_TYPE_LABELS[loc.type] || 'Other';
            const totalValue = detail?.totalValueUsd ?? 0;
            const totalOunces = detail?.totalOunces ?? 0;
            const itemCount = detail?.itemCount ?? 0;
            const insurance = loc.insuranceCoverage || 0;
            const coveragePct = totalValue > 0 ? (insurance / totalValue) * 100 : 0;
            const underInsured = totalValue > 0 && insurance > 0 && coveragePct < 90;
            const uninsured = totalValue > 0 && insurance === 0;
            const overInsured = totalValue > 0 && coveragePct >= 100;

            return (
              <div
                key={loc.id}
                className="bg-charcoal border border-charcoal-light rounded-lg p-5 hover:border-gold/30 transition-all group cursor-pointer"
                onClick={() => openEdit(loc)}
              >
                {/* Header row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-black/50 border border-charcoal-light flex items-center justify-center text-xl">
                      {icon}
                    </div>
                    <div>
                      <h3 className="text-platinum font-semibold text-sm">{loc.name}</h3>
                      <p className="text-silver-dark text-xs">{typeLabel}</p>
                    </div>
                  </div>
                  {/* Insurance badge */}
                  {(uninsured || underInsured) && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        uninsured
                          ? 'bg-red-900/30 text-red-400 border border-red-700/30'
                          : 'bg-amber-900/30 text-amber-400 border border-amber-700/30'
                      }`}
                    >
                      {uninsured ? 'No Insurance' : 'Under-Insured'}
                    </span>
                  )}
                  {overInsured && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider bg-green-900/30 text-green-400 border border-green-700/30">
                      Insured
                    </span>
                  )}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <p className="text-xs text-silver-dark uppercase tracking-wider">Value</p>
                    <p className="text-lg font-bold text-platinum">{fmtUSD(totalValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-silver-dark uppercase tracking-wider">Weight</p>
                    <p className="text-lg font-bold text-gold">{fmtOz(totalOunces)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-silver-dark uppercase tracking-wider">Items</p>
                    <p className="text-lg font-bold text-silver">{itemCount}</p>
                  </div>
                </div>

                {/* Insurance bar */}
                <div className="border-t border-charcoal-light pt-3">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-silver-dark">Insurance Coverage</span>
                    <span className={`font-medium ${uninsured ? 'text-red-400' : underInsured ? 'text-amber-400' : 'text-green-400'}`}>
                      {insurance > 0 ? fmtUSD(insurance) : 'None'}
                    </span>
                  </div>
                  {insurance > 0 && totalValue > 0 && (
                    <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          coveragePct >= 100
                            ? 'bg-green-500'
                            : coveragePct >= 75
                            ? 'bg-amber-400'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(coveragePct, 100)}%` }}
                      />
                    </div>
                  )}
                  {insurance > 0 && (
                    <p className="text-[10px] text-silver-dark mt-1">
                      {coveragePct >= 100
                        ? 'Fully covered'
                        : `${coveragePct.toFixed(0)}% of portfolio value covered`}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-charcoal-light opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(loc);
                    }}
                    className="px-3 py-1.5 text-xs rounded border border-gold/30 text-gold hover:bg-gold/10 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDelete(loc.id);
                    }}
                    className="px-3 py-1.5 text-xs rounded border border-red-700/30 text-red-400 hover:bg-red-900/20 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          Add / Edit Modal
      ═══════════════════════════════════════════════════════ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70" onClick={closeModal} />

          {/* Modal */}
          <div className="relative bg-charcoal border border-charcoal-light rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal-light">
              <h3 className="text-lg font-semibold text-platinum">
                {editingId ? 'Edit Location' : 'Add Location'}
              </h3>
              <button
                onClick={closeModal}
                className="text-silver-dark hover:text-silver transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-silver-dark uppercase tracking-wider mb-1.5">
                  Name <span className="text-gold">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g. Home Safe, Bank Box"
                  className={`w-full px-3 py-2 bg-black/50 border rounded-lg text-silver placeholder:text-silver-dark/50 focus:outline-none transition-colors text-sm ${
                    formErrors.name
                      ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
                      : 'border-charcoal-light focus:border-gold/50 focus:ring-1 focus:ring-gold/30'
                  }`}
                />
                {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-silver-dark uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Brief description of this location"
                  className="w-full px-3 py-2 bg-black/50 border border-charcoal-light rounded-lg text-silver placeholder:text-silver-dark/50 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-colors text-sm"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-silver-dark uppercase tracking-wider mb-1.5">
                  Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {LOCATION_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => updateField('type', t)}
                      className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition-colors ${
                        form.type === t
                          ? 'border-gold bg-gold/10 text-gold'
                          : 'border-charcoal-light text-silver-dark hover:border-silver-dark/50 hover:text-silver'
                      }`}
                    >
                      <span>{LOCATION_TYPE_ICONS[t]}</span>
                      {LOCATION_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Insurance Coverage */}
              <div>
                <label className="block text-xs font-medium text-silver-dark uppercase tracking-wider mb-1.5">
                  Insurance Coverage ($)
                </label>
                <input
                  type="number"
                  value={form.insuranceCoverage}
                  onChange={(e) => updateField('insuranceCoverage', e.target.value)}
                  placeholder="e.g. 500000"
                  min="0"
                  step="1"
                  className={`w-full px-3 py-2 bg-black/50 border rounded-lg text-silver placeholder:text-silver-dark/50 focus:outline-none transition-colors text-sm ${
                    formErrors.insuranceCoverage
                      ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
                      : 'border-charcoal-light focus:border-gold/50 focus:ring-1 focus:ring-gold/30'
                  }`}
                />
                {formErrors.insuranceCoverage && (
                  <p className="text-red-400 text-xs mt-1">{formErrors.insuranceCoverage}</p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-silver-dark uppercase tracking-wider mb-1.5">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  rows={3}
                  placeholder="Any additional notes..."
                  className="w-full px-3 py-2 bg-black/50 border border-charcoal-light rounded-lg text-silver placeholder:text-silver-dark/50 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-colors text-sm resize-y"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-charcoal-light">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-charcoal-light text-silver-dark hover:text-silver hover:border-silver-dark/50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitForm}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold-light transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Spinner />}
                {editingId ? 'Save Changes' : 'Create Location'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          Delete Confirmation Modal
      ═══════════════════════════════════════════════════════ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDeleteTarget(null)} />

          <div className="relative bg-charcoal border border-charcoal-light rounded-xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-5">
              {deleteBlocked ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-900/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">⚠️</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-platinum">Cannot Delete Location</h3>
                      <p className="text-silver-dark text-sm">
                        This location has {deleteBlocked.length} holding{deleteBlocked.length !== 1 ? 's' : ''}. Move or delete them first.
                      </p>
                    </div>
                  </div>
                  <div className="bg-black/30 border border-charcoal-light rounded-lg p-3 max-h-32 overflow-y-auto mb-4">
                    {deleteBlocked.map((name) => (
                      <p key={name} className="text-silver text-sm py-1 border-b border-charcoal-light last:border-0">
                        {name}
                      </p>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => setDeleteTarget(null)}
                      className="px-4 py-2 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold-light transition-colors"
                    >
                      OK, I Understand
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-900/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">🗑️</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-platinum">Delete Location?</h3>
                      <p className="text-silver-dark text-sm">
                        This location is empty. Are you sure you want to delete it? This cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setDeleteTarget(null)}
                      disabled={deleting}
                      className="px-4 py-2 rounded-lg border border-charcoal-light text-silver-dark hover:text-silver transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={executeDelete}
                      disabled={deleting}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {deleting && <Spinner />}
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Spinner ───────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
