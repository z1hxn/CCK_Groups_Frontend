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

const roleItems: RoleItem[] = [
  { role: 'competition', label: '선수', className: 'role-player' },
  { role: 'judge', label: '심판', className: 'role-judge' },
  { role: 'runner', label: '러너', className: 'role-runner' },
  { role: 'scrambler', label: '스크램블러', className: 'role-scrambler' },
];

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

  if (loading) return <div className="empty-state">라운드 배정 정보 로딩 중...</div>;
  if (!Number.isFinite(competitionId) || !Number.isFinite(targetRoundIdx)) {
    return <div className="empty-state">잘못된 접근입니다.</div>;
  }
  if (!competition) return <div className="empty-state">대회 정보를 불러올 수 없습니다.</div>;

  const groups = assignments?.groups ?? [];
  const round = assignments?.round;

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
        {groups.length === 0 ? (
          <div className="empty-state">이 라운드에 배정된 조 정보가 없습니다.</div>
        ) : (
          <div className="round-group-list">
            {groups.map((groupItem) => (
              <section className="round-group-card" key={`${targetRoundIdx}-${groupItem.group}`}>
                <header className="round-group-header">
                  <h3>{groupItem.group}조</h3>
                </header>

                <div className="round-role-grid">
                  {roleItems.map((roleItem) => {
                    const roleAssignments = groupItem[roleItem.role];
                    return (
                      <div className="round-role-panel" key={`${groupItem.group}-${roleItem.role}`}>
                        <div className="round-role-panel-head">
                          <span className={`player-role-badge ${roleItem.className}`}>{roleItem.label}</span>
                          <span>{roleAssignments.length}명</span>
                        </div>
                        <div className="round-role-panel-body">
                          {roleAssignments.length === 0 ? (
                            <span className="round-role-empty">배정 없음</span>
                          ) : (
                            roleAssignments.map((assignment) => (
                              <Link
                                className="round-role-member"
                                key={`${roleItem.role}-${assignment.idx}`}
                                to={`/competition/${competitionId}/player/${encodeURIComponent(assignment.cckId)}`}
                              >
                                {nameByCckId[assignment.cckId.toLowerCase()] ?? assignment.cckId}
                              </Link>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
