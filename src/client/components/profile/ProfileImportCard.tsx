import React, { useState } from 'react';
import { FileUp, Link as LinkIcon, FileText, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch } from '../../lib/api';

export interface ImportedProfilePayload {
  name: string;
  email: string;
  headline: string;
  biography: string;
  location: string;
  companyName: string;
  position: string;
  website: string;
  industry: string;
  avatarUrl: string | null;
  socialLinks: {
    linkedin?: string;
    github?: string;
    x?: string;
    other?: string;
  };
}

export function ProfileImportCard({
  onImport,
  defaultExpanded = false,
  compactTitle = 'Import from LinkedIn URL, PDF, or CV / Resume',
}: {
  onImport: (profile: ImportedProfilePayload) => void;
  defaultExpanded?: boolean;
  compactTitle?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [showTextPaste, setShowTextPaste] = useState(false);

  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function handleRunImport(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setImporting(true);

    try {
      let res: { profile: ImportedProfilePayload; notice?: string };

      if (selectedFile) {
        const formData = new FormData();
        if (linkedinUrl.trim()) formData.set('linkedinUrl', linkedinUrl.trim());
        if (rawText.trim()) formData.set('rawText', rawText.trim());
        formData.set('file', selectedFile);

        res = await apiFetch('/api/users/import-profile', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await apiFetch('/api/users/import-profile', {
          method: 'POST',
          body: JSON.stringify({
            linkedinUrl: linkedinUrl.trim(),
            rawText: rawText.trim(),
          }),
        });
      }

      onImport(res.profile);
      setNotice(
        res.notice ||
          'Profile details extracted and populated into the form below. Review before saving.'
      );
    } catch (err: any) {
      setError(err.message || 'Could not import profile details.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="rounded-md border border-[#CBD5E1] bg-[#F7F9FB] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#E2E8F0]/40 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-[#243B53] text-white">
            <FileUp className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="block text-xs font-bold text-[#1F2937]">{compactTitle}</span>
            <span className="block text-[11px] text-[#64748B]">
              Auto-populate your professional credentials from a LinkedIn URL, LinkedIn “Save to
              PDF”, or CV/Resume (.pdf, .docx, .txt)
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-[#526579]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#526579]" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-[#E2E8F0] bg-white p-4 space-y-4">
          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {notice && (
            <div className="flex items-start gap-2 rounded border border-[#287D7D]/30 bg-[#287D7D]/10 px-3 py-2 text-xs text-[#1D5E5E]">
              <CheckCircle2 className="h-4 w-4 text-[#287D7D] shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Option 1: LinkedIn Public URL */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-[#1F2937] mb-1">
                <LinkIcon className="h-3.5 w-3.5 text-[#243B53]" />
                <span>LinkedIn Public Profile URL</span>
              </label>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/your-name"
                className="w-full rounded border border-[#E2E8F0] px-3 py-1.5 text-xs text-[#1F2937] focus:border-[#243B53] focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-[#64748B]">
                Links your profile URL and extracts available public metadata.
              </p>
            </div>

            {/* Option 2: Upload PDF / CV / Resume */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-[#1F2937] mb-1">
                <FileText className="h-3.5 w-3.5 text-[#287D7D]" />
                <span>Upload LinkedIn PDF or CV / Resume</span>
              </label>
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md,.rtf,.json,application/pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full rounded border border-[#E2E8F0] bg-[#F7F9FB] px-2.5 py-1 text-xs text-[#1F2937] file:mr-2 file:rounded file:border-0 file:bg-[#243B53] file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-white hover:file:bg-[#1B2D40]"
              />
              <p className="mt-1 text-[11px] text-[#64748B]">
                On LinkedIn: click <strong>More → Save to PDF</strong>, or upload any CV/Resume
                (.pdf, .docx, .txt).
              </p>
            </div>
          </div>

          {/* Option 3: Paste Raw Text */}
          <div>
            <button
              type="button"
              onClick={() => setShowTextPaste((v) => !v)}
              className="text-xs font-medium text-[#287D7D] hover:underline"
            >
              {showTextPaste
                ? 'Hide pasted text box'
                : '+ Or paste profile / resume text directly'}
            </button>

            {showTextPaste && (
              <textarea
                rows={4}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste your LinkedIn header, About section, or CV text here..."
                className="mt-2 w-full rounded border border-[#E2E8F0] px-3 py-2 text-xs text-[#1F2937] focus:border-[#243B53] focus:outline-none"
              />
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] pt-3">
            <button
              type="button"
              disabled={importing || (!linkedinUrl.trim() && !selectedFile && !rawText.trim())}
              onClick={handleRunImport}
              className="inline-flex items-center gap-1.5 rounded bg-[#243B53] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1B2D40] disabled:opacity-50"
            >
              <FileUp className="h-3.5 w-3.5" />
              <span>
                {importing ? 'Extracting Profile...' : 'Extract & Populate Profile Fields'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

