import React from 'react';
import { Shield, ShieldCheck, ShieldAlert, Mail } from 'lucide-react';
import { ACCESS_LEVEL_SHORT_LABELS, type AccessLevelValue } from '../../../shared/constants';

export function AccessBadge({
  level,
  prefix,
  size = 'sm',
}: {
  level: AccessLevelValue;
  prefix?: string;
  size?: 'xs' | 'sm';
}) {
  const textSize = size === 'xs' ? 'text-[11px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';

  if (level === 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-medium rounded border border-red-200 bg-red-50 text-red-800 ${textSize}`}
      >
        <ShieldAlert className="w-3 h-3" />
        {prefix ? `${prefix}: ` : ''}Blocked
      </span>
    );
  }

  if (level === 3) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-medium rounded border border-[#287D7D]/30 bg-[#287D7D]/10 text-[#1D5E5E] ${textSize}`}
      >
        <ShieldCheck className="w-3 h-3 text-[#287D7D]" />
        {prefix ? `${prefix}: ` : ''}
        {ACCESS_LEVEL_SHORT_LABELS[3]}
      </span>
    );
  }

  if (level === 2) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-medium rounded border border-[#243B53]/25 bg-[#243B53]/8 text-[#243B53] ${textSize}`}
      >
        <Shield className="w-3 h-3 text-[#243B53]" />
        {prefix ? `${prefix}: ` : ''}
        {ACCESS_LEVEL_SHORT_LABELS[2]}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded border border-[#E2E8F0] bg-[#F7F9FB] text-[#526579] ${textSize}`}
    >
      <Mail className="w-3 h-3 text-[#64748B]" />
      {prefix ? `${prefix}: ` : ''}
      {ACCESS_LEVEL_SHORT_LABELS[1]}
    </span>
  );
}

export function EntityAvatar({
  name,
  avatarUrl,
  isCompany = false,
  size = 'md',
}: {
  name: string;
  avatarUrl?: string | null;
  isCompany?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const dims =
    size === 'sm'
      ? 'w-8 h-8 text-xs'
      : size === 'lg'
      ? 'w-12 h-12 text-base'
      : size === 'xl'
      ? 'w-16 h-16 text-lg'
      : 'w-10 h-10 text-sm';

  const shape = isCompany ? 'rounded-md' : 'rounded-full';

  const initials = (name || 'M')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${dims} ${shape} object-cover border border-[#E2E8F0] bg-white shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${dims} ${shape} flex items-center justify-center font-semibold shrink-0 border ${
        isCompany
          ? 'bg-[#243B53] text-white border-[#243B53]'
          : 'bg-[#E2E8F0]/70 text-[#243B53] border-[#CBD5E1]'
      }`}
    >
      {initials}
    </div>
  );
}

export function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

