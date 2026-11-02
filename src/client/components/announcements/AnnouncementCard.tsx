import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Flag, Trash2, Mail } from 'lucide-react';
import type { AnnouncementItem } from '../../../shared/types';
import { EntityAvatar, formatRelativeTime } from '../ui/AccessBadge';
import { useAuth } from '../../lib/auth-context';

export function AnnouncementCard({
  announcement,
  onDelete,
}: {
  announcement: AnnouncementItem;
  onDelete?: (id: string) => void;
}) {
  const { user, openComposeModal, openReportModal } = useAuth();

  const canDelete =
    user &&
    (user.id === announcement.authorUserId ||
      user.systemRole === 'admin' ||
      user.managedCompanies.some(
        (mc) =>
          mc.id === announcement.companyId && (mc.role === 'owner' || mc.role === 'admin')
      ));

  return (
    <article className="rounded-md border border-[#E2E8F0] bg-white p-4 transition-colors hover:border-[#CBD5E1]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Link to={`/c/${announcement.companySlug}`} className="shrink-0">
            <EntityAvatar
              name={announcement.companyName}
              avatarUrl={announcement.companyLogoUrl}
              isCompany
              size="md"
            />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link
                to={`/c/${announcement.companySlug}`}
                className="text-sm font-semibold text-[#1F2937] hover:text-[#243B53] hover:underline truncate"
              >
                {announcement.companyName}
              </Link>
              <span className="inline-flex items-center rounded border border-[#243B53]/20 bg-[#F7F9FB] px-2 py-0.5 text-[11px] font-medium text-[#243B53]">
                {announcement.categoryName}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#64748B]">
              {announcement.companyIndustry && <span>{announcement.companyIndustry}</span>}
              <span>·</span>
              <time dateTime={new Date(announcement.createdAt).toISOString()}>
                {formatRelativeTime(announcement.createdAt)}
              </time>
              <span>·</span>
              <span>Published by {announcement.authorName}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {user && (
            <button
              type="button"
              onClick={() =>
                openComposeModal({
                  type: 'company',
                  id: announcement.companyId,
                  name: announcement.companyName,
                  subtitle: announcement.companyIndustry,
                })
              }
              title={`Message ${announcement.companyName}`}
              className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-medium text-[#243B53] hover:bg-[#F7F9FB]"
            >
              <Mail className="h-3 w-3" />
              <span className="hidden sm:inline">Message</span>
            </button>
          )}
          {user && (
            <button
              type="button"
              onClick={() =>
                openReportModal({
                  targetType: 'announcement',
                  targetId: announcement.id,
                  targetLabel: `${announcement.companyName} announcement`,
                })
              }
              title="Report announcement"
              className="rounded p-1.5 text-[#64748B] hover:bg-[#F7F9FB] hover:text-[#1F2937]"
            >
              <Flag className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(announcement.id)}
              title="Delete announcement"
              className="rounded p-1.5 text-[#64748B] hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[#1F2937]">
        {announcement.body}
      </p>

      {announcement.externalUrl && (
        <div className="mt-3 pt-2.5 border-t border-[#E2E8F0]/70">
          <a
            href={announcement.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#287D7D] hover:underline break-all"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            <span>{announcement.externalUrl}</span>
          </a>
        </div>
      )}
    </article>
  );
}

