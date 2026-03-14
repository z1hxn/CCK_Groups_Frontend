import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getCompetitionConfirmedRegistrations,
  getCompetitionDetail,
  getCompetitionRoundAssignments,
} from '@/entities/competition/api';
import type { CompetitionDetail, CompetitionRoundAssignments, PlayerRole } from '@/entities/competition/types';
import { PageHeader } from '@/widgets/pageHeader/PageHeader';

type RoleItem = {
  role: PlayerRole;
  label: string;
  className: string;
};
type ViewRole = PlayerRole | 'all';

const roleItems: RoleItem[] = [
  { role: 'competition', label: '출전', className: 'role-player' },
  { role: 'judge', label: '심판', className: 'role-judge' },
  { role: 'runner', label: '러너', className: 'role-runner' },
  { role: 'scrambler', label: '스크램블러', className: 'role-scrambler' },
];
const normalizeGroupName = (value: string) => String(value || '').trim();
const toUniqueSortedGroups = (groups: string[]) => [...new Set(groups)].sort((a, b) => a.localeCompare(b, 'ko-KR'));

const formatKoreanTimeRange = (start?: string, end?: string) => {
  if (!start || !end) return '';
  const dateStart = new Date(start);
  const dateEnd = new Date(end);
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${formatter.format(dateStart)} ~ ${formatter.format(dateEnd)}`;
};

export const CompetitionRoundPage = () => {
  const { compIdx, roundIdx } = useParams();
  const competitionId = Number(compIdx);
  const targetRoundIdx = Number(roundIdx);

  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [assignments, setAssignments] = useState<CompetitionRoundAssignments | null>(null);
  const [nameByCckId, setNameByCckId] = useState<Record<string, string>>({});
  const [activeGroup, setActiveGroup] = useState('');
  const [activeRole, setActiveRole] = useState<ViewRole>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      if (!Number.isFinite(competitionId) || !Number.isFinite(targetRoundIdx)) {
        setLoading(false);
        return;
      }

      try {
        const [competitionResult, assignmentResult, registrations] = await Promise.all([
          getCompetitionDetail(competitionId),
          getCompetitionRoundAssignments(targetRoundIdx),
          getCompetitionConfirmedRegistrations(competitionId),
        ]);
        if (!mounted) return;
        setCompetition(competitionResult);
        setAssignments(assignmentResult);

        const mapEntries = registrations.map((item) => {
          const displayName = item.enName ? `${item.name} (${item.enName})` : item.name;
          return [item.cckId.toLowerCase(), displayName] as const;
        });
        setNameByCckId(Object.fromEntries(mapEntries));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, [competitionId, targetRoundIdx]);

  const roundTitle = useMemo(() => {
    const round = assignments?.round;
    if (!round) return `Round ${targetRoundIdx}`;
    return `${round.cubeEventName} ${round.roundName}`;
  }, [assignments?.round, targetRoundIdx]);

  const roundGroups = assignments?.groups ?? [];
  const groupNames = toUniqueSortedGroups([
    ...(assignments?.round?.roundGroupList ?? []),
    ...roundGroups.map((item) => item.group),
  ]);
  const safeActiveGroup = activeGroup && groupNames.includes(activeGroup) ? activeGroup : groupNames[0] ?? '';
  useEffect(() => {
    if (safeActiveGroup !== activeGroup) {
      setActiveGroup(safeActiveGroup);
    }
  }, [activeGroup, safeActiveGroup]);

  if (loading) return <div className="empty-state">라운드 배정 정보 로딩 중...</div>;
  if (!Number.isFinite(competitionId) || !Number.isFinite(targetRoundIdx)) {
    return <div className="empty-state">잘못된 접근입니다.</div>;
  }
  if (!competition) return <div className="empty-state">대회 정보를 불러올 수 없습니다.</div>;

  const round = assignments?.round;
  const rowsByRole = roleItems.map((roleItem) => ({
    roleItem,
    rows:
      safeActiveGroup && assignments
        ? assignments[roleItem.role].filter(
            (item) => normalizeGroupName(item.group) === normalizeGroupName(safeActiveGroup),
          )
        : [],
  }));
  const allEntries = rowsByRole.flatMap(({ roleItem, rows }) =>
    rows.map((assignment) => ({
      assignment,
      role: roleItem.role,
      label: roleItem.label,
      className: roleItem.className,
    })),
  );
  const rowEntries =
    activeRole === 'all'
      ? allEntries
      : rowsByRole
          .filter(({ roleItem }) => roleItem.role === activeRole)
          .flatMap(({ roleItem, rows }) =>
            rows.map((assignment) => ({
              assignment,
              role: roleItem.role,
              label: roleItem.label,
              className: roleItem.className,
            })),
          );
  const filteredRows = rowEntries.filter((entry) => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return true;
    const name = nameByCckId[entry.assignment.cckId.toLowerCase()] ?? entry.assignment.cckId;
    return name.toLowerCase().includes(keyword) || entry.assignment.cckId.toLowerCase().includes(keyword);
  });

  return (
    <div className="comp-page">
      <PageHeader
        containerClassName="comp-header"
        title={roundTitle}
        subtitle={
          <>
            <span>{competition.name}</span>
            {round?.eventStart && round?.eventEnd ? (
              <>
                <span className="page-title-meta-divider">·</span>
                <span>{formatKoreanTimeRange(round.eventStart, round.eventEnd)}</span>
              </>
            ) : null}
          </>
        }
        actions={[
          {
            label: '라운드 목록',
            to: `/competition/${competitionId}?view=round`,
            iconSrc: '/icon/button/back.svg',
          },
        ]}
      />

      <div className="comp-content">
        {groupNames.length === 0 ? (
          <div className="empty-state">이 라운드에 배정된 조 정보가 없습니다.</div>
        ) : (
          <div className="round-group-manage-wrap">
            <div className="comp-view-tabs">
              {groupNames.map((groupName) => (
                <button
                  key={groupName}
                  type="button"
                  className={`comp-view-tab ${safeActiveGroup === groupName ? 'active' : ''}`}
                  onClick={() => setActiveGroup(groupName)}
                >
                  {groupName}조
                </button>
              ))}
            </div>

            <section className="round-group-card">
              <header className="round-group-header">
                <h3>{safeActiveGroup}조</h3>
              </header>

              <div className="round-role-tab-list">
                <button
                  key="role-tab-all"
                  type="button"
                  className={`round-role-tab role-all ${activeRole === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveRole('all')}
                >
                  전체 ({allEntries.length})
                </button>
                {roleItems.map((roleItem) => {
                  const count = rowsByRole.find((item) => item.roleItem.role === roleItem.role)?.rows.length ?? 0;
                  return (
                    <button
                      key={`role-tab-${roleItem.role}`}
                      type="button"
                      className={`round-role-tab ${roleItem.className} ${activeRole === roleItem.role ? 'active' : ''}`}
                      onClick={() => setActiveRole(roleItem.role)}
                    >
                      {roleItem.label} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="round-role-search">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="이름 또는 CCK ID 검색"
                />
              </div>

              <div className="round-role-list">
                {filteredRows.length === 0 ? (
                  <span className="round-role-empty">배정 없음</span>
                ) : (
                  filteredRows.map((entry) => (
                    <Link
                      className="round-role-list-item"
                      key={`${entry.role}-${entry.assignment.idx}`}
                      to={`/competition/${competitionId}/player/${encodeURIComponent(entry.assignment.cckId)}`}
                    >
                      <span className={`player-role-badge ${entry.className}`}>{entry.label}</span>
                      <span>
                        {nameByCckId[entry.assignment.cckId.toLowerCase()] ?? entry.assignment.cckId}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
