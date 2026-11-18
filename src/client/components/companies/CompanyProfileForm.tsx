import React, { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { EntityAvatar } from '../ui/AccessBadge';
import { readImageFileAsDataUrl } from '../../lib/image-upload';
import { INDUSTRIES, COMPANY_SIZES } from '../../../shared/constants';
import type { SocialLinks } from '../../../shared/types';

export interface CompanyFormValues {
  name: string;
  description: string;
  website: string;
  industry: string;
  headquarters: string;
  companySize: string;
  contactInfo: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl: string;
  socialLinks: SocialLinks;
}

interface CompanyProfileFormProps {
  title: string;
  subtitle?: string;
  submitLabel: string;
  submittingLabel: string;
  initialValues?: Partial<CompanyFormValues>;
  onSubmit: (values: CompanyFormValues) => Promise<void>;
  onCancel: () => void;
}

export function CompanyProfileForm({
  title,
  subtitle,
  submitLabel,
  submittingLabel,
  initialValues,
  onSubmit,
  onCancel,
}: CompanyProfileFormProps) {
  const [name, setName] = useState(initialValues?.name || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [website, setWebsite] = useState(initialValues?.website || '');
  const [industry, setIndustry] = useState<string>(initialValues?.industry || INDUSTRIES[0]);
  const [headquarters, setHeadquarters] = useState(initialValues?.headquarters || '');
  const [companySize, setCompanySize] = useState<string>(
    initialValues?.companySize || COMPANY_SIZES[0]
  );
  const [contactEmail, setContactEmail] = useState(initialValues?.contactEmail || '');
  const [contactPhone, setContactPhone] = useState(initialValues?.contactPhone || '');
  const [contactInfo, setContactInfo] = useState(initialValues?.contactInfo || '');
  const [logoUrl, setLogoUrl] = useState(initialValues?.logoUrl || '');
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({
    linkedin: initialValues?.socialLinks?.linkedin || '',
    x: initialValues?.socialLinks?.x || '',
    github: initialValues?.socialLinks?.github || '',
    other: initialValues?.socialLinks?.other || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUploadedDataUrl = logoUrl.startsWith('data:image/');

  async function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setLogoUrl(dataUrl);
    } catch (err: any) {
      setError(err.message || 'Could not load selected image');
    } finally {
      e.target.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        description,
        website,
        industry,
        headquarters,
        companySize,
        contactInfo,
        contactEmail,
        contactPhone,
        logoUrl,
        socialLinks,
      });
    } catch (err: any) {
      setError(err.message || 'Could not save company profile');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-[#243B53]/30 bg-white p-5 sm:p-6 space-y-4"
    >
      <div className="border-b border-[#E2E8F0] pb-3">
        <h2 className="text-sm font-bold text-[#1F2937]">{title}</h2>
        {subtitle && <p className="text-xs text-[#64748B]">{subtitle}</p>}
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-[#1F2937] mb-1">Company Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Northstar Infrastructure Partners"
            className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#1F2937] mb-1">Industry *</label>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#1F2937]"
          >
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-[#1F2937] mb-1">
            Headquarters Location *
          </label>
          <input
            type="text"
            required
            value={headquarters}
            onChange={(e) => setHeadquarters(e.target.value)}
            placeholder="New York, NY"
            className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#1F2937] mb-1">Company Size *</label>
          <select
            value={companySize}
            onChange={(e) => setCompanySize(e.target.value)}
            className="w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#1F2937]"
          >
            {COMPANY_SIZES.map((sz) => (
              <option key={sz} value={sz}>
                {sz}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#1F2937] mb-1">Website</label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://company.com"
            className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937]"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[#1F2937] mb-1">
          Factual Company Description *
        </label>
        <textarea
          required
          rows={3}
          minLength={10}
          maxLength={1000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what the company builds, operates, or provides..."
          className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937]"
        />
      </div>

      {/* Company Logo: URL or Drive Upload */}
      <div className="rounded border border-[#E2E8F0] bg-[#F7F9FB] p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <label className="block text-xs font-semibold text-[#1F2937]">
            Company Logo (Optional)
          </label>
          <span className="text-[11px] text-[#64748B]">
            Paste an image URL or select a file from your device
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <EntityAvatar
            name={name || 'Company'}
            avatarUrl={logoUrl.trim() || null}
            isCompany
            size="lg"
          />
          <div className="flex-1 min-w-[200px] space-y-2">
            <input
              type="url"
              value={isUploadedDataUrl ? '' : logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder={
                isUploadedDataUrl
                  ? 'Logo uploaded from device (or paste a URL to replace)'
                  : 'https://company.com/logo.png'
              }
              className="w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#1F2937]"
            />
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                onChange={handleLogoFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-medium text-[#1F2937] hover:bg-[#F1F5F9]"
              >
                <Upload className="h-3.5 w-3.5 text-[#243B53]" />
                <span>Select from Device</span>
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl('')}
                  className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#64748B] hover:text-red-700"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Remove Logo</span>
                </button>
              )}
              {isUploadedDataUrl && (
                <span className="text-[11px] font-medium text-[#287D7D]">
                  Image ready from device
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Public Contact Information */}
      <div className="space-y-2.5 border-t border-[#E2E8F0] pt-3">
        <div>
          <h3 className="text-xs font-semibold text-[#1F2937]">
            Public Contact Information (Optional)
          </h3>
          <p className="text-[11px] text-[#64748B]">
            Shown on your public company profile so visitors know how to reach you.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-[#1F2937] mb-1">Public Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="inquiries@company.com"
              className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-xs text-[#1F2937]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2937] mb-1">Public Phone</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+1 (604) 555-0140"
              className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-xs text-[#1F2937]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2937] mb-1">
              Office / Contact Note
            </label>
            <input
              type="text"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="Institutional Inquiries · Vancouver Office"
              className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-xs text-[#1F2937]"
            />
          </div>
        </div>
      </div>

      {/* Social Networks */}
      <div className="space-y-2.5 border-t border-[#E2E8F0] pt-3">
        <div>
          <h3 className="text-xs font-semibold text-[#1F2937]">Social Networks (Optional)</h3>
          <p className="text-[11px] text-[#64748B]">
            Link your company’s official social or developer profiles.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-[#1F2937] mb-1">LinkedIn</label>
            <input
              type="url"
              value={socialLinks.linkedin || ''}
              onChange={(e) => setSocialLinks((s) => ({ ...s, linkedin: e.target.value }))}
              placeholder="https://linkedin.com/company/your-company"
              className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-xs text-[#1F2937]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2937] mb-1">X / Twitter</label>
            <input
              type="url"
              value={socialLinks.x || ''}
              onChange={(e) => setSocialLinks((s) => ({ ...s, x: e.target.value }))}
              placeholder="https://x.com/yourcompany"
              className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-xs text-[#1F2937]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2937] mb-1">GitHub</label>
            <input
              type="url"
              value={socialLinks.github || ''}
              onChange={(e) => setSocialLinks((s) => ({ ...s, github: e.target.value }))}
              placeholder="https://github.com/your-org"
              className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-xs text-[#1F2937]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1F2937] mb-1">Other Link</label>
            <input
              type="url"
              value={socialLinks.other || ''}
              onChange={(e) => setSocialLinks((s) => ({ ...s, other: e.target.value }))}
              placeholder="https://youtube.com/@yourcompany"
              className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-xs text-[#1F2937]"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-[#E2E8F0] px-3.5 py-1.5 text-xs font-medium text-[#526579]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-[#243B53] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1B2D40] disabled:opacity-50"
        >
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
