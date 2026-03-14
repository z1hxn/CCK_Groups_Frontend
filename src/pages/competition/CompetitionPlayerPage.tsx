import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getCompetitionDetail,
  getCompetitionPlayerAssignments,
  getCompetitionRoundsByDay,
} from '@/entities/competition/api';
import { getAuthInfoByCckId } from '@/features/auth/api';
import { normalizeCckId } from '@/shared/lib/cckId';
import type {
  CompetitionDetail,
  CompetitionPlayerAssignments,
  PlayerRole,
  Round,
} from '@/entities/competition/types';
import { PageHeader } from '@/widgets/pageHeader/PageHeader';

type RoleBadge = {
  role: PlayerRole;
  label: string;
  className: string;
};

type TimelineRow = {
  roundIdx: number;
  title: string;
  eventStart: string;
  badge: RoleBadge;
  group: string;
};

type TimelineRenderGroup = {
  key: string;
  title: string;
  eventStart: string;
  entries: Array<{
    badge: RoleBadge;
    group: string;
  }>;
};

const roleMeta: Record<PlayerRole, { label: string; className: string }> = {
  competitor: { label: '선수', className: 'role-player' },
  judge: { label: '심판', className: 'role-judge' },
  runner: { label: '러너', className: 'role-runner' },
  scrambler: { label: '스크램블러', className: 'role-scrambler' },
};
const roleOrder: Record<PlayerRole, number> = {
  competitor: 1,
  judge: 2,
  runner: 3,
  scrambler: 4,
};

const formatKoreanTime = (iso: string) =>
  new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));

const getCompetitionDays = (competition: CompetitionDetail) => {
  const start = new Date(competition.dateStart);
  const end = new Date(competition.dateEnd);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return [0];
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diffMs = endMidnight.getTime() - startMidnight.getTime();
  const dayCount = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
  return Array.from({ length: dayCount + 1 }, (_, index) => index);
};

const dedupeRounds = (rounds: Round[]) => {
  const roundMap = new Map<number, Round>();
  for (const round of rounds) {
    roundMap.set(round.id, round);
  }
  return [...roundMap.values()].sort((a, b) => new Date(a.eventStart).getTime() - new Date(b.eventStart).getTime());
};

export const CompetitionPlayerPage = () => {
  const { compIdx, cckId } = useParams();
  const competitionId = Number(compIdx);
  const playerId = normalizeCckId(cckId);

  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [timelineRounds, setTimelineRounds] = useState<Round[]>([]);
  const [assignments, setAssignments] = useState<CompetitionPlayerAssignments | null>(null);
  const [displayPlayerName, setDisplayPlayerName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchPageData = async () => {
      if (!Number.isFinite(competitionId) || !playerId) {
        setLoading(false);
        return;
      }

      try {
        const [competitionResult, assignmentResult] = await Promise.all([
          getCompetitionDetail(competitionId),
          getCompetitionPlayerAssignments(competitionId, playerId),
        ]);
        if (!mounted) return;

        setCompetition(competitionResult);
        setAssignments(assignmentResult);
        setDisplayPlayerName(playerId);

        try {
          const authInfo = await getAuthInfoByCckId(playerId);
          if (!mounted) return;
          if (authInfo.name && authInfo.enName) {
            setDisplayPlayerName(`${authInfo.name} (${authInfo.enName})`);
          } else if (authInfo.name) {
            setDisplayPlayerName(authInfo.name);
          }
        } catch {
          // Keep fallback name when auth service is unavailable.
        }

        if (!competitionResult) return;

        const days = getCompetitionDays(competitionResult);
        const schedules = await Promise.all(days.map((day) => getCompetitionRoundsByDay(competitionId, day)));
        if (!mounted) return;

        setTimelineRounds(
          dedupeRounds(
            schedules.flatMap((schedule) => [
              ...schedule.past,
              ...schedule.now,
              ...schedule.future,
            ]),
          ),
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchPageData();
    return () => {
      mounted = false;
    };
  }, [competitionId, playerId]);

  const rows = useMemo<TimelineRenderGroup[]>(() => {
    if (!assignments) return [];

    const roleEntries: Array<{ role: PlayerRole; roundIdx: number; group: string; title: string; eventStart: string }> = [];

    const pushEntries = (role: PlayerRole, entries: CompetitionPlayerAssignments[PlayerRole]) => {
      for (const entry of entries) {
        const scheduleRound = timelineRounds.find((round) => round.id === entry.roundIdx);
        const title = scheduleRound
          ? `${scheduleRound.eventName} ${scheduleRound.roundName}`
          : entry.round
            ? `${entry.round.cubeEventName} ${entry.round.roundName}`
            : `Round ${entry.roundIdx}`;
        const eventStart = scheduleRound?.eventStart || entry.round?.eventStart || '';
        roleEntries.push({
          role,
          roundIdx: entry.roundIdx,
          group: entry.group,
          title,
          eventStart,
        });
      }
    };

    pushEntries('competitor', assignments.competitor);
    pushEntries('judge', assignments.judge);
    pushEntries('runner', assignments.runner);
    pushEntries('scrambler', assignments.scrambler);

    const flatRows: TimelineRow[] = roleEntries
      .map((entry) => ({
        roundIdx: entry.roundIdx,
        title: entry.title,
        eventStart: entry.eventStart,
        badge: {
          role: entry.role,
          label: roleMeta[entry.role].label,
          className: roleMeta[entry.role].className,
        },
        group: entry.group,
      }))
      .sort((a, b) => {
        const timeDiff = new Date(a.eventStart).getTime() - new Date(b.eventStart).getTime();
        if (timeDiff !== 0) return timeDiff;
        const roleDiff = roleOrder[a.badge.role] - roleOrder[b.badge.role];
        if (roleDiff !== 0) return roleDiff;
        return a.group.localeCompare(b.group, 'ko-KR');
      });

    const grouped = new Map<number, TimelineRenderGroup>();
    for (const row of flatRows) {
      const existing = grouped.get(row.roundIdx);
      if (!existing) {
        grouped.set(row.roundIdx, {
          key: `round-${row.roundIdx}`,
          title: row.title,
          eventStart: row.eventStart,
          entries: [{ badge: row.badge, group: row.group }],
        });
        continue;
      }
      existing.entries.push({ badge: row.badge, group: row.group });
    }
    return [...grouped.values()];
  }, [assignments, timelineRounds]);

  if (loading) return <div className="empty-state">선수 일정 로딩 중...</div>;
  if (!Number.isFinite(competitionId) || !playerId) return <div className="empty-state">잘못된 접근입니다.</div>;
  if (!competition) return <div className="empty-state">대회 정보를 불러올 수 없습니다.</div>;

  const playerName = displayPlayerName || playerId;

  return (
    <div className="comp-page">
      <PageHeader
        containerClassName="comp-header"
        title={playerName}
        subtitle={
          <>
            <span>{playerId}</span>
            <span className="page-title-meta-divider">·</span>
            <span>{competition.name}</span>
          </>
        }
        actions={[
          {
            label: '선수 정보',
            href: `https://ranking.cubingclub.com/profile/${playerId}`,
            iconSrc: '/icon/button/person.svg',
          },
          {
            label: '참가자 목록',
            to: `/competition/${competitionId}`,
            iconSrc: '/icon/button/back.svg',
          },
        ]}
      />

      {rows.length === 0 ? (
        <div className="empty-state">해당 선수의 배정 정보가 없습니다.</div>
      ) : (
        <div className="player-timeline">
          <div className="player-timeline-head">
            <span>활동</span>
            <span>시간</span>
            <span>배정</span>
            <span>그룹</span>
          </div>
          {rows.map((row) => (
            <div className="player-timeline-group" key={row.key}>
              <div className="player-timeline-cell player-timeline-activity">
                {row.title}
              </div>
              <div className="player-timeline-cell">
                {formatKoreanTime(row.eventStart)}
              </div>
              <div className="player-timeline-cell player-assignment-list player-assignment-badges">
                {row.entries.map((entry, index) => (
                  <div className="player-assignment-item" key={`${row.key}-badge-${index}`}>
                    <span className={`player-role-badge ${entry.badge.className}`}>{entry.badge.label}</span>
                  </div>
                ))}
              </div>
              <div className="player-timeline-cell player-assignment-list">
                {row.entries.map((entry, index) => (
                  <div className="player-assignment-item" key={`${row.key}-group-${index}`}>
                    {entry.group || '-'}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
