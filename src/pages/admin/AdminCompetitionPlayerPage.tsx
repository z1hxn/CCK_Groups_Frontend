import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getAdminRoundGroupConfig,
  getCompetitionConfirmedRegistrations,
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
  RoundGroupConfig,
  Round,
} from '@/entities/competition/types';
import { getAuthInfoByCckId } from '@/features/auth/api';
import { isAdminByToken } from '@/shared/auth/tokenStorage';
import { OverlayConfirm, OverlayToast } from '@/widgets/overlay';
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
const normalizeEventName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '');
const normalizeGroupName = (value: string) => String(value || '').trim();
const roleLimitFieldByRole: Record<PlayerRole, keyof RoundGroupConfig['groups'][number]> = {
  competition: 'playerCount',
  judge: 'judgeCount',
  runner: 'runnerCount',
  scrambler: 'scramblerCount',
};

export const AdminCompetitionPlayerPage = () => {
  const { compIdx, cckId } = useParams();
  const competitionId = Number(compIdx);
  const playerCckId = String(cckId || '').trim();

  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [assignments, setAssignments] = useState<CompetitionPlayerAssignments | null>(null);
  const [roundAssignmentMap, setRoundAssignmentMap] = useState<Record<number, CompetitionRoundAssignments>>({});
  const [roundConfigMap, setRoundConfigMap] = useState<Record<number, RoundGroupConfig>>({});
  const [selectedGroupsByKey, setSelectedGroupsByKey] = useState<Record<string, string[]>>({});
  const [forcedOpenByRound, setForcedOpenByRound] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: '',
    message: '',
  });
  const [toast, setToast] = useState<{ open: boolean; message: string; variant: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    variant: 'info',
  });
  const confirmActionRef = useRef<null | (() => void)>(null);

  const loadData = async () => {
    if (!Number.isFinite(competitionId) || !playerCckId) return;

    const [competitionResult, assignmentResult, registrationResult] = await Promise.all([
      getCompetitionDetail(competitionId),
      getCompetitionPlayerAssignments(competitionId, playerCckId),
      getCompetitionConfirmedRegistrations(competitionId),
    ]);

    setCompetition(competitionResult);
    setAssignments(assignmentResult);
    const registration = registrationResult.find((item) => item.cckId.toLowerCase() === playerCckId.toLowerCase());
    setSelectedEvents(Array.isArray(registration?.selectedEvents) ? registration.selectedEvents : []);

    const rounds = (competitionResult?.rounds ?? []).sort(
      (a, b) => new Date(a.eventStart).getTime() - new Date(b.eventStart).getTime(),
    );
    const [roundDetails, roundConfigs] = await Promise.all([
      Promise.all(rounds.map((round) => getCompetitionRoundAssignments(round.id))),
      Promise.all(rounds.map((round) => getAdminRoundGroupConfig(competitionId, round.id))),
    ]);
    const mapByRound: Record<number, CompetitionRoundAssignments> = {};
    for (const detail of roundDetails) {
      mapByRound[detail.roundIdx] = detail;
    }
    setRoundAssignmentMap(mapByRound);
    const configMapByRound: Record<number, RoundGroupConfig> = {};
    for (const config of roundConfigs) {
      configMapByRound[config.roundIdx] = config;
    }
    setRoundConfigMap(configMapByRound);

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
  const selectedEventSet = useMemo(() => new Set(selectedEvents.map((item) => normalizeEventName(item))), [selectedEvents]);

  if (!isAdminByToken()) return <div className="empty-state">403 Forbidden</div>;
  if (loading) return <div className="empty-state">선수 상세 로딩 중...</div>;
  if (!competition) return <div className="empty-state">대회 정보를 불러올 수 없습니다.</div>;
  if (!assignments) return <div className="empty-state">선수 배정 정보를 불러올 수 없습니다.</div>;

  const askConfirm = (title: string, message: string, action: () => void) => {
    confirmActionRef.current = action;
    setConfirm({ open: true, title, message });
  };

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
            label: '선수 목록',
            to: `/admin/competition/${competitionId}`,
            iconSrc: '/icon/button/back.svg',
          },
        ]}
      />

      <div className="comp-content admin-content">
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
              const isParticipating =
                selectedEventSet.size === 0 || selectedEventSet.has(normalizeEventName(round.eventName));
              const isForcedOpen = Boolean(forcedOpenByRound[round.id]);
              const canEditRound = isParticipating || isForcedOpen;
              const isOpen = canEditRound;

              return (
                <div
                  className={`admin-assignment-row ${!canEditRound ? 'admin-assignment-row-inactive' : ''}`}
                  key={round.id}
                >
                  <button
                    type="button"
                    className="admin-round-toggle"
                    onClick={() => {
                      if (canEditRound) return;
                      askConfirm(
                        '미참가 종목 예외 배정',
                        `${round.eventName} ${round.roundName}은 미참가 종목입니다. 경고를 확인하고 예외 배정을 열까요?`,
                        () =>
                          setForcedOpenByRound((prev) => ({
                            ...prev,
                            [round.id]: true,
                          })),
                      );
                    }}
                  >
                    <strong className={!canEditRound ? 'admin-round-title-strike' : ''}>
                      {round.eventName} {round.roundName}
                    </strong>
                    <span>
                      {isParticipating
                        ? '참가 종목'
                        : canEditRound
                          ? '예외 배정 모드'
                          : '미참가 종목 · 클릭하여 예외 배정'}
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="admin-assignment-roles admin-assignment-roles--check">
                      {roleItems.map((roleItem) => {
                        const key = makeFieldKey(round.id, roleItem.role);
                        const selected = selectedGroupsByKey[key] ?? [];
                        const disabledByEvent = !canEditRound;

                        return (
                          <div
                            className={`admin-role-check-card ${disabledByEvent ? 'admin-role-check-card-disabled' : ''}`}
                            key={key}
                          >
                            <div className="admin-role-check-head">
                              <strong>{roleItem.label}</strong>
                              <span>
                                {disabledByEvent
                                  ? '미참가 종목'
                                  : roleItem.singleSelect
                                    ? '1개만 선택'
                                    : '복수 선택 가능'}
                              </span>
                            </div>

                            {groupNames.length === 0 ? (
                              <div className="round-role-empty">조 정보가 없습니다.</div>
                            ) : (
                              <div className="admin-role-check-list">
                                {groupNames.map((groupName) => {
                                  const checked = selected.includes(groupName);
                                  const roundConfig = roundConfigMap[round.id];
                                  const normalizedGroupName = normalizeGroupName(groupName);
                                  const groupConfig = roundConfig?.groups?.find(
                                    (item) => normalizeGroupName(item.groupName) === normalizedGroupName,
                                  );
                                  const limitField = roleLimitFieldByRole[roleItem.role];
                                  const roleLimit = Number(groupConfig?.[limitField] || 0);
                                  const currentAssignedCount = (roundDetail?.[roleItem.role] ?? []).filter(
                                    (item) => normalizeGroupName(item.group) === normalizedGroupName,
                                  ).length;
                                  const alreadyAssignedToThisGroup = (assignments[roleItem.role] ?? []).some(
                                    (item) =>
                                      item.roundIdx === round.id &&
                                      normalizeGroupName(item.group) === normalizedGroupName,
                                  );
                                  const projectedCount = currentAssignedCount + (alreadyAssignedToThisGroup ? 0 : 1);
                                  const occupiedByRole = roleItems.find((item) => {
                                    if (item.role === roleItem.role) return false;
                                    const otherSelected = selectedGroupsByKey[makeFieldKey(round.id, item.role)] ?? [];
                                    return otherSelected.includes(groupName);
                                  });
                                  const disabledByConflict = Boolean(occupiedByRole) && !checked;
                                  const disabled = disabledByEvent || disabledByConflict;
                                  return (
                                    <label
                                      className={[
                                        'admin-check-item',
                                        checked ? 'admin-check-item-checked' : '',
                                        disabled ? 'admin-check-item-disabled' : '',
                                        disabledByConflict ? 'admin-check-item-conflict' : '',
                                      ]
                                        .filter(Boolean)
                                        .join(' ')}
                                      key={`${key}-${groupName}`}
                                    >
                                      <input
                                        type="checkbox"
                                        className={disabledByConflict ? 'admin-check-input-conflict' : ''}
                                        checked={checked}
                                        disabled={disabled}
                                        onChange={() => {
                                          if (disabled) return;
                                          const applyChange = () => {
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
                                          };

                                          if (!checked && roleLimit > 0 && projectedCount > roleLimit) {
                                            if (roleItem.role === 'competition') {
                                              setToast({
                                                open: true,
                                                variant: 'error',
                                                message: `${round.eventName} ${round.roundName} ${groupName}조 출전 정원(${roleLimit})이 가득 찼습니다.`,
                                              });
                                              return;
                                            }
                                            setToast({
                                              open: true,
                                              variant: 'info',
                                              message: `${groupName}조 ${roleItem.label} 정원(${roleLimit})을 초과합니다. 예비 운영을 위해 추가합니다.`,
                                            });
                                          }

                                          applyChange();
                                        }}
                                      />
                                      <span>{groupName}조</span>
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
                try {
                  const overLimitCompetitionMessages: string[] = [];
                  const overLimitReserveMessages: string[] = [];

                  for (const round of rounds) {
                    const roundDetail = roundAssignmentMap[round.id];
                    const roundConfig = roundConfigMap[round.id];
                    for (const roleItem of roleItems) {
                      const groups = selectedGroupsByKey[makeFieldKey(round.id, roleItem.role)] ?? [];
                      const currentAssignmentSet = new Set(
                        (assignments[roleItem.role] ?? [])
                          .filter((item) => item.roundIdx === round.id)
                          .map((item) => normalizeGroupName(item.group)),
                      );
                      for (const groupName of groups) {
                        const normalizedGroupName = normalizeGroupName(groupName);
                        const limitField = roleLimitFieldByRole[roleItem.role];
                        const groupConfig = roundConfig?.groups?.find(
                          (item) => normalizeGroupName(item.groupName) === normalizedGroupName,
                        );
                        const roleLimit = Number(groupConfig?.[limitField] || 0);
                        if (roleLimit <= 0) continue;

                        const currentAssignedCount = (roundDetail?.[roleItem.role] ?? []).filter(
                          (item) => normalizeGroupName(item.group) === normalizedGroupName,
                        ).length;
                        const alreadyAssigned = currentAssignmentSet.has(normalizedGroupName);
                        const projectedCount = currentAssignedCount + (alreadyAssigned ? 0 : 1);
                        if (projectedCount <= roleLimit) continue;

                        if (roleItem.role === 'competition') {
                          overLimitCompetitionMessages.push(
                            `${round.eventName} ${round.roundName} ${groupName}조 출전 정원(${roleLimit}) 초과`,
                          );
                        } else {
                          overLimitReserveMessages.push(
                            `${round.eventName} ${round.roundName} ${groupName}조 ${roleItem.label} 정원(${roleLimit}) 초과`,
                          );
                        }
                      }
                    }
                  }

                  if (overLimitCompetitionMessages.length > 0) {
                    setToast({
                      open: true,
                      variant: 'error',
                      message: `출전 정원 초과로 저장할 수 없습니다. (${overLimitCompetitionMessages[0]})`,
                    });
                    return;
                  }

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
                  if (overLimitReserveMessages.length > 0) {
                    setToast({
                      open: true,
                      message: `저장 완료 (주의: ${overLimitReserveMessages[0]})`,
                      variant: 'info',
                    });
                  } else {
                    setToast({ open: true, message: '조편성 저장이 완료되었습니다.', variant: 'success' });
                  }
                } catch (error) {
                  setToast({ open: true, message: `저장 실패: ${String(error)}`, variant: 'error' });
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

      <OverlayConfirm
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmLabel="열기"
        cancelLabel="취소"
        onCancel={() => {
          confirmActionRef.current = null;
          setConfirm((prev) => ({ ...prev, open: false }));
        }}
        onConfirm={() => {
          const action = confirmActionRef.current;
          confirmActionRef.current = null;
          setConfirm((prev) => ({ ...prev, open: false }));
          action?.();
        }}
      />
      <OverlayToast
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
};
