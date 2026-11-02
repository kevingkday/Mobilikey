import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Newspaper,
  Mail,
  ShieldCheck,
  Sliders,
  ArrowRight,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { AnnouncementCard } from '../components/announcements/AnnouncementCard';
import { apiFetch } from '../lib/api';
import type { AnnouncementItem } from '../../shared/types';

export function LandingPage() {
  const [recentAnnouncements, setRecentAnnouncements] = useState<AnnouncementItem[]>([]);

  useEffect(() => {
    apiFetch<{ announcements: AnnouncementItem[] }>('/api/announcements?feed=public')
      .then((res) => setRecentAnnouncements((res.announcements || []).slice(0, 4)))
      .catch(() => {});
  }, []);

  const supportingSections = [
    {
      icon: Newspaper,
      title: 'Business news that matters',
      description:
        'Short, factual company announcements without endless opinion posts.',
    },
    {
      icon: Mail,
      title: 'Message anyone for free',
      description: 'No InMail credits or paid messaging subscriptions.',
    },
    {
      icon: ShieldCheck,
      title: 'Earn direct access',
      description:
        'Build relationships and earn higher-priority access to individual professionals and companies.',
    },
    {
      icon: Sliders,
      title: 'Control your inbox',
      description:
        'Decide who gets your attention and who can reach you directly.',
    },
  ];

  const accessTiers = [
    {
      level: 'Level 1 — General Access',
      badge: 'Default for Everyone',
      description:
        'Anyone can send an initial professional inquiry, subject to spam controls. Messages arrive in a low-priority General Requests folder—equivalent to reaching info@company.com.',
    },
    {
      level: 'Level 2 — Recognized Access',
      badge: 'Granted by Recipient',
      description:
        'For contacts who have established relevance or recognition. Messages appear in a dedicated Recognized inbox, separated from cold outreach.',
    },
    {
      level: 'Level 3 — Direct Access',
      badge: 'Explicit Priority Access',
      description:
        'Equivalent to holding someone’s direct professional contact information. Messages arrive in the recipient’s Priority Direct inbox and trigger standard notifications.',
    },
  ];

  return (
    <AppShell>
      <div className="space-y-12 py-4">
        {/* Hero Section */}
        <section className="rounded-md border border-[#E2E8F0] bg-white p-8 sm:p-12">
          <div className="max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded border border-[#E2E8F0] bg-[#F7F9FB] px-3 py-1 text-xs font-medium text-[#243B53]">
              <span>Mobilikey Professional Directory & Communications</span>
              <span className="text-[#64748B]">·</span>
              <span className="text-[#287D7D]">Earn access. Build connections.</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1F2937] leading-tight">
              Professional connections. Without the noise.
            </h1>

            <p className="text-base sm:text-lg text-[#526579] leading-relaxed">
              A simpler professional network for company announcements, meaningful conversations,
              and direct connections.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded bg-[#243B53] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1B2D40]"
              >
                <span>Join Free</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/search"
                className="inline-flex items-center gap-2 rounded border border-[#CBD5E1] bg-white px-5 py-2.5 text-sm font-semibold text-[#243B53] hover:bg-[#F7F9FB]"
              >
                <span>Explore Network</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Supporting Four Pillars */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {supportingSections.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-md border border-[#E2E8F0] bg-white p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded border border-[#E2E8F0] bg-[#F7F9FB] text-[#243B53]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-[#1F2937]">{item.title}</h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#64748B]">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </section>

        {/* Three-Level Messaging Access Architecture */}
        <section className="rounded-md border border-[#E2E8F0] bg-white p-6 sm:p-8">
          <div className="max-w-2xl mb-6">
            <h2 className="text-lg font-bold text-[#1F2937]">
              How the Three-Level Messaging Access System Works
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#64748B]">
              Access is directional and managed independently by every professional and company.
              There is no universal social score, and replying never automatically promotes a
              sender.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {accessTiers.map((tier, idx) => (
              <div
                key={tier.level}
                className="rounded border border-[#E2E8F0] bg-[#F7F9FB] p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-[#243B53]">0{idx + 1}</span>
                    <span className="rounded border border-[#CBD5E1] bg-white px-2 py-0.5 text-[11px] font-medium text-[#526579]">
                      {tier.badge}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-[#1F2937]">{tier.level}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#526579]">{tier.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-[#E2E8F0] pt-5 text-xs text-[#526579]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#287D7D] shrink-0" />
              <span>Directional: Access A → B is independent of B → A</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#287D7D] shrink-0" />
              <span>Replies never auto-promote a sender’s access level</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#287D7D] shrink-0" />
              <span>Company inboxes are isolated from employee personal inboxes</span>
            </div>
          </div>
        </section>

        {/* Recent Public Company Announcements */}
        {recentAnnouncements.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#1F2937]">
                  Recent Business Announcements
                </h2>
                <p className="text-xs text-[#64748B]">
                  Concise, 500-character factual updates published by verified company profiles.
                </p>
              </div>
              <Link
                to="/announcements"
                className="text-xs font-semibold text-[#287D7D] hover:underline"
              >
                View All Announcements →
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {recentAnnouncements.map((ann) => (
                <AnnouncementCard key={ann.id} announcement={ann} />
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

