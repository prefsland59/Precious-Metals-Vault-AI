import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { StorageLocation, Holding } from '@pmvault/shared';
import {
  METAL_TYPES,
  METAL_LABELS,
  CATEGORIES,
  CATEGORY_LABELS,
} from '@pmvault/shared';

// ─── Form Types ────────────────────────────────────────────────────

interface FormData {
  metal: string;
  category: string;
  name: string;
  mint: string;
  country: string;
  series: string;
  year: string;
  weight: string;
  weightUnit: 'oz' | 'g' | 'kg';
  purity: string;
  quantity: string;
  purchasePrice: string;
  purchaseCurrency: string;
  purchaseDate: string;
  dealer: string;
  taxes: string;
  shipping: string;
  storageLocation: string;
  condition: string;
  estimatedGrade: string;
  certificationNumber: string;
  slabCompany: string;
  serialNumber: string;
  notes: string;
}

interface FormErrors {
  [key: string]: string;
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF'];

const emptyForm: FormData = {
  metal: 'silver',
  category: 'coin',
  name: '',
  mint: '',
  country: '',
  series: '',
  year: '',
  weight: '1',
  weightUnit: 'oz',
  purity: '0.999',
  quantity: '1',
  purchasePrice: '',
  purchaseCurrency: 'USD',
  purchaseDate: new Date().toISOString().slice(0, 10),
  dealer: '',
  taxes: '0',
  shipping: '0',
  storageLocation: '',
  condition: '',
  estimatedGrade: '',
  certificationNumber: '',
  slabCompany: '',
  serialNumber: '',
  notes: '',
};

// ─── Helpers ───────────────────────────────────────────────────────

function toGrams(weight: number, unit: 'oz' | 'g' | 'kg'): number {
  switch (unit) {
    case 'g': return weight;
    case 'kg': return weight * 1000;
    case 'oz': return weight * 31.1035;
  }
}

function toTroyOz(weight: number, unit: 'oz' | 'g' | 'kg'): number {
  switch (unit) {
    case 'oz': return weight;
    case 'g': return weight / 31.1035;
    case 'kg': return (weight * 1000) / 31.1035;
  }
}

// ─── Component ─────────────────────────────────────────────────────

export function AddHoldingPage({ onSuccess }: { onSuccess?: () => void }) {
  const [form, setForm] = useState<FormData>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // ─── Load storage locations ──────────────────────────────────
  useEffect(() => {
    api.get<StorageLocation[]>('/api/storage-locations')
      .then((data) => {
        setLocations(data);
        if (data.length > 0 && !form.storageLocation) {
          setForm((prev) => ({ ...prev, storageLocation: data[0].id }));
        }
      })
      .catch(() => setToast({ type: 'error', message: 'Failed to load storage locations' }))
      .finally(() => setLocationsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Computed values ──────────────────────────────────────────
  const weightNum = parseFloat(form.weight) || 0;
  const purityNum = parseFloat(form.purity) || 0;
  const quantityNum = parseInt(form.quantity) || 0;
  const priceNum = parseFloat(form.purchasePrice) || 0;
  const taxesNum = parseFloat(form.taxes) || 0;
  const shippingNum = parseFloat(form.shipping) || 0;

  const apwOz = toTroyOz(weightNum, form.weightUnit) * purityNum;
  const totalCost = (priceNum * quantityNum) + taxesNum + shippingNum;

  // ─── Field update helper ──────────────────────────────────────
  const updateField = useCallback((field: keyof FormData, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      // Reset purity to 0.999 if metal is changed to a precious metal and purity is still default-ish
      if (field === 'metal') {
        if (['gold', 'silver', 'platinum', 'palladium'].includes(value) && prev.purity === '1') {
          next.purity = '0.999';
        }
      }

      return next;
    });
    // Clear error for this field
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // ─── Toggle section collapse ──────────────────────────────────
  const toggleSection = (section: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  // ─── Validation ───────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: FormErrors = {};

    if (!form.metal) errs.metal = 'Metal is required';
    if (!form.category) errs.category = 'Category is required';
    if (!form.name.trim()) errs.name = 'Product name is required';
    if (!form.weight || parseFloat(form.weight) <= 0) errs.weight = 'Valid weight is required';
    if (!form.purity || parseFloat(form.purity) <= 0 || parseFloat(form.purity) > 1) errs.purity = 'Purity must be between 0 and 1';
    if (!form.purchasePrice || parseFloat(form.purchasePrice) < 0) errs.purchasePrice = 'Purchase price is required';
    if (!form.purchaseDate) errs.purchaseDate = 'Purchase date is required';
    if (!form.storageLocation) errs.storageLocation = 'Storage location is required';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ─── Submit ───────────────────────────────────────────────────
  const submit = async (resetAfter: boolean) => {
    if (!validate()) return;

    setSubmitting(true);
    setToast(null);

    const grams = toGrams(weightNum, form.weightUnit);

    const body = {
      name: form.name.trim(),
      metal: form.metal,
      category: form.category,
      weight: toTroyOz(weightNum, form.weightUnit),
      weightUnit: form.weightUnit,
      weightGrams: grams,
      purity: purityNum,
      quantity: quantityNum,
      purchasePrice: priceNum,
      purchaseCurrency: form.purchaseCurrency,
      purchaseDate: form.purchaseDate,
      dealer: form.dealer.trim(),
      taxesCents: Math.round(taxesNum * 100),
      shippingCents: Math.round(shippingNum * 100),
      totalCostCents: Math.round(totalCost * 100),
      storageLocationId: form.storageLocation,
      storageLocation: form.storageLocation,
      condition: form.condition.trim(),
      estimatedGrade: form.estimatedGrade.trim(),
      grade: form.estimatedGrade.trim(),
      certificationNumber: form.certificationNumber.trim(),
      slabCompany: form.slabCompany.trim(),
      serialNumber: form.serialNumber.trim(),
      notes: form.notes.trim(),
      images: [],
      documents: [],
    };

    try {
      await api.post<Holding>('/api/holdings', body);
      setToast({ type: 'success', message: 'Holding saved successfully!' });
      setErrors({});
      if (resetAfter) {
        setForm(emptyForm);
      }
      onSuccess?.();
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save holding',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Cancel (reset form) ──────────────────────────────────────
  const cancel = () => {
    setForm(emptyForm);
    setErrors({});
    setToast(null);
  };

  // ─── Dismiss toast ────────────────────────────────────────────
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // ═══════════════════════════════════════════════════════════════
  //  Render
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-platinum mb-1">Add Holding</h2>
        <p className="text-silver-dark text-sm">Manually enter a new precious metals item into your portfolio.</p>
      </div>

      {/* ─── Toast ─────────────────────────────────────────────── */}
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

      {/* ═════════════════ SECTIONS ═════════════════════════════ */}
      <div className="space-y-4">
        {/* ─── Section 1: Metal & Category ──────────────────── */}
        <SectionCard
          title="Metal & Category"
          collapsed={collapsed.has('s1')}
          onToggle={() => toggleSection('s1')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Metal"
              value={form.metal}
              onChange={(v) => updateField('metal', v)}
              options={METAL_TYPES.map((m) => ({ value: m, label: METAL_LABELS[m] }))}
              error={errors.metal}
              required
            />
            <SelectField
              label="Category"
              value={form.category}
              onChange={(v) => updateField('category', v)}
              options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
              error={errors.category}
              required
            />
          </div>
        </SectionCard>

        {/* ─── Section 2: Product Details ──────────────────── */}
        <SectionCard
          title="Product Details"
          collapsed={collapsed.has('s2')}
          onToggle={() => toggleSection('s2')}
        >
          <TextField
            label="Product Name"
            value={form.name}
            onChange={(v) => updateField('name', v)}
            placeholder="e.g. American Eagle, Canadian Maple Leaf"
            error={errors.name}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label="Mint" value={form.mint} onChange={(v) => updateField('mint', v)} placeholder="e.g. US Mint, Royal Canadian Mint" />
            <TextField label="Country" value={form.country} onChange={(v) => updateField('country', v)} placeholder="e.g. United States" />
            <TextField label="Series" value={form.series} onChange={(v) => updateField('series', v)} placeholder="e.g. American Eagle" />
            <TextField label="Year" value={form.year} onChange={(v) => updateField('year', v)} placeholder="e.g. 2024" type="number" />
          </div>
        </SectionCard>

        {/* ─── Section 3: Weight & Purity ──────────────────── */}
        <SectionCard
          title="Weight & Purity"
          collapsed={collapsed.has('s3')}
          onToggle={() => toggleSection('s3')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TextField
              label="Weight"
              value={form.weight}
              onChange={(v) => updateField('weight', v)}
              type="number"
              min="0"
              step="0.001"
              error={errors.weight}
              required
            />
            <SelectField
              label="Weight Unit"
              value={form.weightUnit}
              onChange={(v) => updateField('weightUnit', v)}
              options={[
                { value: 'oz', label: 'oz (Troy Ounce)' },
                { value: 'g', label: 'g (Gram)' },
                { value: 'kg', label: 'kg (Kilogram)' },
              ]}
            />
            <TextField
              label="Purity (0–1)"
              value={form.purity}
              onChange={(v) => updateField('purity', v)}
              type="number"
              min="0"
              max="1"
              step="0.0001"
              error={errors.purity}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <ReadonlyField
              label="Actual Precious Metal Weight"
              value={`${apwOz.toFixed(4)} oz`}
            />
            <TextField
              label="Quantity"
              value={form.quantity}
              onChange={(v) => updateField('quantity', v)}
              type="number"
              min="1"
              step="1"
            />
          </div>
        </SectionCard>

        {/* ─── Section 4: Purchase Details ─────────────────── */}
        <SectionCard
          title="Purchase Details"
          collapsed={collapsed.has('s4')}
          onToggle={() => toggleSection('s4')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              label="Purchase Price (per unit)"
              value={form.purchasePrice}
              onChange={(v) => updateField('purchasePrice', v)}
              type="number"
              min="0"
              step="0.01"
              error={errors.purchasePrice}
              required
              prefix="$"
            />
            <SelectField
              label="Currency"
              value={form.purchaseCurrency}
              onChange={(v) => updateField('purchaseCurrency', v)}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
            <TextField
              label="Purchase Date"
              value={form.purchaseDate}
              onChange={(v) => updateField('purchaseDate', v)}
              type="date"
              error={errors.purchaseDate}
              required
            />
            <TextField label="Dealer" value={form.dealer} onChange={(v) => updateField('dealer', v)} placeholder="e.g. JM Bullion, APMEX" />
            <TextField
              label="Taxes"
              value={form.taxes}
              onChange={(v) => updateField('taxes', v)}
              type="number"
              min="0"
              step="0.01"
              prefix="$"
            />
            <TextField
              label="Shipping"
              value={form.shipping}
              onChange={(v) => updateField('shipping', v)}
              type="number"
              min="0"
              step="0.01"
              prefix="$"
            />
          </div>
          <ReadonlyField
            label="Total Cost"
            value={`$${totalCost.toFixed(2)}`}
          />
        </SectionCard>

        {/* ─── Section 5: Storage & Condition ──────────────── */}
        <SectionCard
          title="Storage & Condition"
          collapsed={collapsed.has('s5')}
          onToggle={() => toggleSection('s5')}
        >
          <SelectField
            label="Storage Location"
            value={form.storageLocation}
            onChange={(v) => updateField('storageLocation', v)}
            options={locations.map((l) => ({ value: l.id, label: l.name }))}
            loading={locationsLoading}
            error={errors.storageLocation}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label="Condition" value={form.condition} onChange={(v) => updateField('condition', v)} placeholder="e.g. BU, Proof, Circulated" />
            <TextField label="Estimated Grade" value={form.estimatedGrade} onChange={(v) => updateField('estimatedGrade', v)} placeholder="e.g. MS-70, PF-69" />
            <TextField label="Slab Company" value={form.slabCompany} onChange={(v) => updateField('slabCompany', v)} placeholder="e.g. PCGS, NGC" />
            <TextField label="Certification Number" value={form.certificationNumber} onChange={(v) => updateField('certificationNumber', v)} placeholder="Cert #" />
          </div>
          <TextField
            label="Serial Number"
            value={form.serialNumber}
            onChange={(v) => updateField('serialNumber', v)}
            placeholder="e.g. Item serial or tracking ID"
          />
        </SectionCard>

        {/* ─── Section 6: Notes ────────────────────────────── */}
        <SectionCard
          title="Notes"
          collapsed={collapsed.has('s6')}
          onToggle={() => toggleSection('s6')}
        >
          <div>
            <label className="block text-xs font-medium text-silver-dark uppercase tracking-wider mb-1.5">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={4}
              placeholder="Any additional notes about this holding..."
              className="w-full px-3 py-2 bg-black/50 border border-charcoal-light rounded-lg text-silver placeholder:text-silver-dark/50 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-colors text-sm resize-y"
            />
          </div>
        </SectionCard>
      </div>

      {/* ═════════════════ ACTIONS ══════════════════════════════ */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-end border-t border-charcoal-light pt-6">
        <button
          type="button"
          onClick={cancel}
          disabled={submitting}
          className="px-5 py-2.5 rounded-lg border border-charcoal-light text-silver-dark hover:text-silver hover:border-silver-dark/50 transition-colors text-sm font-medium disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={submitting}
          className="px-5 py-2.5 rounded-lg border border-gold/40 text-gold hover:bg-gold/10 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {submitting && <Spinner />}
          Save & Add Another
        </button>
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={submitting}
          className="px-6 py-2.5 rounded-lg bg-gold text-black font-semibold text-sm hover:bg-gold-light transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {submitting && <Spinner />}
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Section Card ──────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  collapsed,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-charcoal border border-charcoal-light rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-hover transition-colors"
      >
        <h3 className="text-gold text-sm font-semibold uppercase tracking-wider">{title}</h3>
        <span className={`text-silver-dark text-sm transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      {!collapsed && (
        <div className="px-5 pb-5 space-y-4 border-t border-charcoal-light pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Form Fields ───────────────────────────────────────────────────

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  error,
  required,
  min,
  max,
  step,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
  prefix?: string;
}) {
  const inputId = label.replace(/\s+/g, '-').toLowerCase();

  return (
    <div>
      <label htmlFor={inputId} className="block text-xs font-medium text-silver-dark uppercase tracking-wider mb-1.5">
        {label}
        {required && <span className="text-gold ml-0.5">*</span>}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-silver-dark text-sm">{prefix}</span>
        )}
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className={`w-full px-3 py-2 bg-black/50 border rounded-lg text-silver placeholder:text-silver-dark/50 focus:outline-none transition-colors text-sm
            ${prefix ? 'pl-7' : ''}
            ${type === 'date' ? '[color-scheme:dark]' : ''}
            ${error
              ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
              : 'border-charcoal-light focus:border-gold/50 focus:ring-1 focus:ring-gold/30'
            }
          `}
        />
      </div>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  error,
  required,
  loading,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  error?: string;
  required?: boolean;
  loading?: boolean;
}) {
  const selectId = label.replace(/\s+/g, '-').toLowerCase();

  return (
    <div>
      <label htmlFor={selectId} className="block text-xs font-medium text-silver-dark uppercase tracking-wider mb-1.5">
        {label}
        {required && <span className="text-gold ml-0.5">*</span>}
      </label>
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className={`w-full px-3 py-2 bg-black/50 border rounded-lg text-silver focus:outline-none transition-colors text-sm appearance-none
          ${error
            ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
            : 'border-charcoal-light focus:border-gold/50 focus:ring-1 focus:ring-gold/30'
          }
        `}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M6 8L1 3h10z' fill='%238a8a8a'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          backgroundSize: '12px',
        }}
      >
        {loading && <option value="">Loading...</option>}
        {!loading && options.length === 0 && <option value="">No locations available</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-silver-dark uppercase tracking-wider mb-1.5">{label}</label>
      <div className="px-3 py-2 bg-black/30 border border-charcoal-light rounded-lg text-gold-light font-mono text-sm">
        {value}
      </div>
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
