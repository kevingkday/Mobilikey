import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Flag, Trash2, Mail, UserPlus, UserCheck } from 'lucide-react';
import type { AnnouncementItem } from '../../../shared/types';
import { EntityAvatar, formatRelativeTime } from '../ui/AccessBadge';
import { useAuth } from '../../lib/auth-context';
import { apiFetch } from '../../lib/api';

export function AnnouncementCard({
  announcement,
  onDelete,
  onFollowChange,
}: {
  announcement: AnnouncementItem;
  onDelete?: (id: string) => void;
  onFollowChange?: (targetId: string, following: boolean) => void;
}) {
  const { user, openComposeModal, openReportModal } = useAuth();
  const isCompanyPost = Boolean(announcement.companyId && announcement.companySlug);
  const targetType = isCompanyPost ? 'company' : 'user';
  const targetId = isCompanyPost ? announcement.companyId! : announcement.authorUserId;
  const displayName = isCompanyPost
    ? announcement.companyName || announcement.authorName
    : announcement.authorName;
  const displayAvatarUrl = isCompanyPost
    ? announcement.companyLogoUrl
    : announcement.authorAvatarUrl;
  const profileLink = isCompanyPost
    ? `/c/${announcement.companySlug}`
    : `/p/${announcement.authorSlug}`;
  const initialFollowing = isCompanyPost
    ? Boolean(announcement.isFollowingCompany)
    : Boolean(announcement.isFollowingAuthor);

  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [togglingFollow, setTogglingFollow] = useState(false);

  useEffect(() => {
    setIsFollowing(
      isCompanyPost
        ? Boolean(announcement.isFollowingCompany)
        : Boolean(announcement.isFollowingAuthor)
    );
  }, [isCompanyPost, announcement.isFollowingCompany, announcement.isFollowingAuthor]);

  const canDelete =
    user &&
    (user.id === announcement.authorUserId ||
      user.systemRole === 'admin' ||
      (announcement.companyId
        ? user.managedCompanies.some(
            (mc) =>
              mc.id === announcement.companyId && (mc.role === 'owner' || mc.role === 'admin')
          )
        : false));

  async function handleToggleFollow() {
    if (!user || togglingFollow) return;
    setTogglingFollow(true);
    try {
      const res = await apiFetch<{ following: boolean }>('/api/users/follow', {
        method: 'POST',
        body: JSON.stringify({
          targetType,
          targetId,
        }),
      });
      setIsFollowing(res.following);
      onFollowChange?.(targetId, res.following);
    } catch {
      // ignore
    } finally {
      setTogglingFollow(false);
    }
  }

  return (
    <article className="rounded-md border border-[#E2E8F0] bg-white p-4 transition-colors hover:border-[#CBD5E1]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Link to={profileLink} className="shrink-0">
            <EntityAvatar
              name={displayName}
              avatarUrl={displayAvatarUrl}
              isCompany={isCompanyPost}
              size="md"
            />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link
                to={profileLink}
                className="text-sm font-semibold text-[#1F2937] hover:text-[#243B53] hover:underline truncate"
              >
                {displayName}
              </Link>
              <span className="inline-flex items-center rounded border border-[#243B53]/20 bg-[#F7F9FB] px-2 py-0.5 text-[11px] font-medium text-[#243B53]">
                {announcement.categoryName}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#64748B]">
              {isCompanyPost ? (
                <>
                  {announcement.companyIndustry && <span>{announcement.companyIndustry}</span>}
                  {announcement.companyIndustry && <span>·</span>}
                  <time dateTime={new Date(announcement.createdAt).toISOString()}>
                    {formatRelativeTime(announcement.createdAt)}
                  </time>
                  <span>·</span>
                  <span>Published by {announcement.authorName}</span>
                </>
              ) : (
                <>
                  {announcement.authorHeadline && (
                    <>
                      <span className="truncate max-w-[260px]">{announcement.authorHeadline}</span>
                      <span>·</span>
                    </>
                  )}
                  <time dateTime={new Date(announcement.createdAt).toISOString()}>
                    {formatRelativeTime(announcement.createdAt)}
                  </time>
                  <span>·</span>
                  <span>Individual Update</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {user && (isCompanyPost || user.id !== announcement.authorUserId) && (
            <button
              type="button"
              disabled={togglingFollow}
              onClick={handleToggleFollow}
              title={isFollowing ? `Following ${displayName}` : `Follow ${displayName}`}
              className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                isFollowing
                  ? 'border-[#287D7D]/30 bg-[#287D7D]/10 text-[#1D5E5E]'
                  : 'border-[#E2E8F0] bg-[#F7F9FB] text-[#526579] hover:text-[#1F2937]'
              }`}
            >
              {isFollowing ? (
                <>
                  <UserCheck className="h-3 w-3 text-[#287D7D]" />
                  <span className="hidden sm:inline">Following</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-3 w-3" />
                  <span className="hidden sm:inline">Follow</span>
                </>
              )}
            </button>
          )}
          {user && (isCompanyPost || user.id !== announcement.authorUserId) && (
            <button
              type="button"
              onClick={() =>
                openComposeModal({
                  type: targetType,
                  id: targetId,
                  name: displayName,
                  subtitle: isCompanyPost
                    ? announcement.companyIndustry || ''
                    : announcement.authorHeadline || '',
                })
              }
              title={`Message ${displayName}`}
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
                  targetLabel: `${displayName} announcement`,
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
