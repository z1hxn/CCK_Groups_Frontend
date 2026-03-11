import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getCompetitionDetail,
  getCompetitionPlayerAssignments,
  getCompetitionRoundAssignments,
  updateCompetitionPlayerAssignment,
} from '@/entities/competition/api';
import type {
  CompetitionDetail,
  CompetitionPlayerAssignments,
  CompetitionRoundAssignments,
  PlayerRole,
  Round,
} from '@/entities/competition/types';
import { getAuthInfoByCckId } from '@/features/auth/api';
import { isAdminByToken } from '@/shared/auth/tokenStorage';
import { PageHeader } from '@/widgets/pageHeader/PageHeader';

type RoleMeta = { role: PlayerRole; label: string; singleSelect: boolean };

const roleItems: RoleMeta[] = [
  { role: 'competition', label: '출전', singleSelect: true },
  { role: 'judge', label: '심판', singleSelect: false },
  { role: 'runner', label: '러너', singleSelect: false },
  { role: 'scrambler', label: '스크램블러', singleSelect: false },
];

const makeFieldKey = (roundIdx: number, role: PlayerRole) => `${roundIdx}-${role}`;

const toUniqueSortedGroups = (groups: string[]) => [...new Set(groups)].sort((a, b) => a.localeCompare(b, 'ko-KR'));

export const AdminCompetitionPlayerPage = () => {
  const { compIdx, cckId } = useParams();
  const competitionId = Number(compIdx);
  const playerCckId = String(cckId || '').trim();

  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [assignments, setAssignments] = useState<CompetitionPlayerAssignments | null>(null);
  const [roundAssignmentMap, setRoundAssignmentMap] = useState<Record<number, CompetitionRoundAssignments>>({});
  const [selectedGroupsByKey, setSelectedGroupsByKey] = useState<Record<string, string[]>>({});
  const [expandedRounds, setExpandedRounds] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [playerName, setPlayerName] = useState('');

  const loadData = async () => {
    if (!Number.isFinite(competitionId) || !playerCckId) return;

    const [competitionResult, assignmentResult] = await Promise.all([
      getCompetitionDetail(competitionId),
      getCompetitionPlayerAssignments(competitionId, playerCckId),
    ]);

    setCompetition(competitionResult);
    setAssignments(assignmentResult);

    const rounds = (competitionResult?.rounds ?? []).sort(
      (a, b) => new Date(a.eventStart).getTime() - new Date(b.eventStart).getTime(),
    );
    const roundDetails = await Promise.all(rounds.map((round) => getCompetitionRoundAssignments(round.id)));
    const mapByRound: Record<number, CompetitionRoundAssignments> = {};
    for (const detail of roundDetails) {
      mapByRound[detail.roundIdx] = detail;
    }
    setRoundAssignmentMap(mapByRound);

    const nextSelected: Record<string, string[]> = {};
    for (const roleItem of roleItems) {
      const grouped = new Map<number, string[]>();
      for (const item of assignmentResult[roleItem.role]) {
        if (!grouped.has(item.roundIdx)) grouped.set(item.roundIdx, []);
        grouped.get(item.roundIdx)?.push(item.group);
      }
      for (const [roundIdx, groups] of grouped) {
        nextSelected[makeFieldKey(roundIdx, roleItem.role)] = toUniqueSortedGroups(groups);
      }
    }
    setSelectedGroupsByKey(nextSelected);

    const nextExpanded: Record<number, boolean> = {};
    for (const round of rounds) {
      const hasSelection = roleItems.some((roleItem) => {
        const key = makeFieldKey(round.id, roleItem.role);
        return (nextSelected[key] ?? []).length > 0;
      });
      nextExpanded[round.id] = hasSelection;
    }
    if (rounds.length > 0 && !Object.values(nextExpanded).some(Boolean)) {
      nextExpanded[rounds[0].id] = true;
    }
    setExpandedRounds(nextExpanded);
  };

  useEffect(() => {
    let mounted = true;

    const fetchAll = async () => {
      if (!Number.isFinite(competitionId) || !playerCckId) {
        setLoading(false);
        return;
      }
      try {
        await loadData();
        try {
          const authInfo = await getAuthInfoByCckId(playerCckId);
          if (!mounted) return;
          if (authInfo.name && authInfo.enName) setPlayerName(`${authInfo.name} (${authInfo.enName})`);
          else if (authInfo.name) setPlayerName(authInfo.name);
          else setPlayerName(playerCckId);
        } catch {
          if (mounted) setPlayerName(playerCckId);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchAll();
    return () => {
      mounted = false;
    };
  }, [competitionId, playerCckId]);

  const rounds = useMemo<Round[]>(
    () =>
      competition?.rounds
        ? [...competition.rounds].sort((a, b) => new Date(a.eventStart).getTime() - new Date(b.eventStart).getTime())
        : [],
    [competition?.rounds],
  );

  const warnings = useMemo(() => {
    const items: string[] = [];
    for (const round of rounds) {
      const byGroup = new Map<string, string[]>();
      for (const roleItem of roleItems) {
        const selected = selectedGroupsByKey[makeFieldKey(round.id, roleItem.role)] ?? [];
        for (const group of selected) {
          if (!byGroup.has(group)) byGroup.set(group, []);
          byGroup.get(group)?.push(roleItem.label);
        }
      }
      for (const [group, labels] of byGroup) {
        if (labels.length > 1) {
          items.push(`${round.eventName} ${round.roundName} - 조 ${group}: ${labels.join(', ')} 역할 중복`);
        }
      }
    }
    return items;
  }, [rounds, selectedGroupsByKey]);

  if (!isAdminByToken()) return <div className="empty-state">403 Forbidden</div>;
  if (loading) return <div className="empty-state">선수 상세 로딩 중...</div>;
  if (!competition) return <div className="empty-state">대회 정보를 불러올 수 없습니다.</div>;
  if (!assignments) return <div className="empty-state">선수 배정 정보를 불러올 수 없습니다.</div>;

  return (
    <div className="comp-page">
      <PageHeader
        containerClassName="comp-header"
        title={playerName || playerCckId}
        subtitle={
          <>
            <span>{playerCckId}</span>
            <span className="page-title-meta-divider">·</span>
            <span>{competition.name}</span>
          </>
        }
        actions={[
          {
            label: '사람 목록',
            to: `/admin/competition/${competitionId}`,
            iconSrc: '/icon/button/back.svg',
          },
        ]}
      />

      <div className="comp-content admin-content">
        {notice ? <div className="player-note">{notice}</div> : null}
        {warnings.length > 0 ? (
          <div className="admin-warning-box">
            {warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        ) : null}

        <section className="admin-panel">
          <h3>조편성 수정</h3>
          <div className="admin-assignment-list">
            {rounds.map((round) => {
              const roundDetail = roundAssignmentMap[round.id];
              const groupNamesFromRound =
                roundDetail?.round?.roundGroupList && roundDetail.round.roundGroupList.length > 0
                  ? roundDetail.round.roundGroupList
                  : (roundDetail?.groups ?? []).map((item) => item.group);
              const selectedFromAllRoles = roleItems.flatMap(
                (roleItem) => selectedGroupsByKey[makeFieldKey(round.id, roleItem.role)] ?? [],
              );
              const groupNames = toUniqueSortedGroups([...groupNamesFromRound, ...selectedFromAllRoles]);
              const isOpen = Boolean(expandedRounds[round.id]);

              return (
                <div className="admin-assignment-row" key={round.id}>
                  <button
                    type="button"
                    className="admin-round-toggle"
                    onClick={() =>
                      setExpandedRounds((prev) => ({
                        ...prev,
                        [round.id]: !prev[round.id],
                      }))
                    }
                  >
                    <strong>
                      {round.eventName} {round.roundName}
                    </strong>
                    <span>{isOpen ? '접기' : '열기'}</span>
                  </button>

                  {isOpen ? (
                    <div className="admin-assignment-roles admin-assignment-roles--check">
                      {roleItems.map((roleItem) => {
                        const key = makeFieldKey(round.id, roleItem.role);
                        const selected = selectedGroupsByKey[key] ?? [];

                        return (
                          <div className="admin-role-check-card" key={key}>
                            <div className="admin-role-check-head">
                              <strong>{roleItem.label}</strong>
                              <span>{roleItem.singleSelect ? '1개만 선택' : '복수 선택 가능'}</span>
                            </div>

                            {groupNames.length === 0 ? (
                              <div className="round-role-empty">조 정보가 없습니다.</div>
                            ) : (
                              <div className="admin-role-check-list">
                                {groupNames.map((groupName) => {
                                  const checked = selected.includes(groupName);
                                  return (
                                    <label className="admin-check-item" key={`${key}-${groupName}`}>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          setSelectedGroupsByKey((prev) => {
                                            const current = prev[key] ?? [];
                                            const has = current.includes(groupName);
                                            let next: string[];

                                            if (roleItem.singleSelect) {
                                              next = has ? [] : [groupName];
                                            } else {
                                              next = has ? current.filter((item) => item !== groupName) : [...current, groupName];
                                            }

                                            return {
                                              ...prev,
                                              [key]: toUniqueSortedGroups(next),
                                            };
                                          });
                                        }}
                                      />
                                      <span>조 {groupName}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="admin-save-footer">
            <button
              type="button"
              disabled={saving}
              className="admin-save-all-btn"
              onClick={async () => {
                setSaving(true);
                setNotice('');
                try {
                  const tasks: Array<Promise<void>> = [];
                  for (const round of rounds) {
                    for (const roleItem of roleItems) {
                      const groups = selectedGroupsByKey[makeFieldKey(round.id, roleItem.role)] ?? [];
                      tasks.push(
                        updateCompetitionPlayerAssignment(competitionId, {
                          cckId: playerCckId,
                          role: roleItem.role,
                          roundIdx: round.id,
                          groups,
                        }),
                      );
                    }
                  }
                  await Promise.all(tasks);
                  await loadData();
                  setNotice('조편성 저장이 완료되었습니다.');
                } catch (error) {
                  setNotice(`저장 실패: ${String(error)}`);
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? '저장 중...' : '전체 저장'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
