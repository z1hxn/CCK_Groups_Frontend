import { useEffect, useMemo, useState } from 'react';
import {
  getAdminRoundGroupConfig,
  getCompetitionConfirmedRegistrations,
  updateAdminRoundGroupConfig,
} from '@/entities/competition/api';
import type { ConfirmedRegistration, Round, RoundGroupConfig } from '@/entities/competition/types';
import { OverlayToast } from '@/widgets/overlay';

type EditableGroup = RoundGroupConfig['groups'][number];
type GroupNamingMode = 'number' | 'alpha' | 'custom';

const GROUP_NAMING_MODE_LABEL: Record<GroupNamingMode, string> = {
  number: '숫자',
  alpha: '영어',
  custom: '커스텀',
};

const normalizeEventName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '');

const naturalGroupSort = (a: string, b: string) =>
  a.localeCompare(b, 'ko-KR', { numeric: true, sensitivity: 'base' });

const isFinalRound = (roundName: string) => String(roundName || '').trim().toLowerCase() === 'final';

const toExcelColumnName = (index: number): string => {
  let current = index + 1;
  let label = '';
  while (current > 0) {
    const remainder = (current - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    current = Math.floor((current - 1) / 26);
  }
  return label;
};

const normalizeGroups = (groups: EditableGroup[]) => {
  const map = new Map<string, EditableGroup>();
  for (const item of groups) {
    const groupName = String(item.groupName || '').trim();
    if (!groupName) continue;
    map.set(groupName, {
      groupName,
      playerCount: Math.max(0, Number(item.playerCount) || 0),
      judgeCount: Math.max(0, Number(item.judgeCount) || 0),
      runnerCount: Math.max(0, Number(item.runnerCount) || 0),
      scramblerCount: Math.max(0, Number(item.scramblerCount) || 0),
    });
  }
  return [...map.values()].sort((a, b) => naturalGroupSort(a.groupName, b.groupName));
};

const ensureFinalRoundDefaultGroup = (round: Round, groups: EditableGroup[]): EditableGroup[] => {
  const normalized = normalizeGroups(groups);
  if (isFinalRound(round.roundName) && normalized.length === 0) {
    return [{ groupName: 'FINAL', playerCount: 0, judgeCount: 0, runnerCount: 0, scramblerCount: 0 }];
  }
  return normalized;
};

const getNextNumberGroupName = (groups: EditableGroup[]) => {
  const used = new Set(groups.map((item) => item.groupName.trim()));
  let current = 1;
  while (used.has(String(current))) current += 1;
  return String(current);
};

const getNextAlphaGroupName = (groups: EditableGroup[]) => {
  const used = new Set(groups.map((item) => item.groupName.trim().toUpperCase()));
  let index = 0;
  while (used.has(toExcelColumnName(index))) index += 1;
  return toExcelColumnName(index);
};

const distributePlayersByGroupCount = (totalPlayers: number, groupCount: number): number[] => {
  if (groupCount <= 0) return [];
  const base = Math.floor(totalPlayers / groupCount);
  const remainder = totalPlayers % groupCount;
  return Array.from({ length: groupCount }, (_, index) => base + (index < remainder ? 1 : 0));
};

type Props = {
  competitionId: number;
  rounds: Round[];
};

export const AdminRoundGroupConfigEditorList = ({ competitionId, rounds }: Props) => {
  const sortedRounds = useMemo(
    () => [...rounds].sort((a, b) => new Date(a.eventStart).getTime() - new Date(b.eventStart).getTime()),
    [rounds],
  );

  const [groupsByRound, setGroupsByRound] = useState<Record<number, EditableGroup[]>>({});
  const [namingModeByRound, setNamingModeByRound] = useState<Record<number, GroupNamingMode>>({});
  const [customGroupNameByRound, setCustomGroupNameByRound] = useState<Record<number, string>>({});
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);
  const [registrations, setRegistrations] = useState<ConfirmedRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRoundIdx, setSavingRoundIdx] = useState<number | null>(null);
  const [toast, setToast] = useState<{ open: boolean; message: string; variant: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    variant: 'info',
  });

  useEffect(() => {
    let mounted = true;
    const fetchConfigs = async () => {
      setLoading(true);
      try {
        const [configs, registrationData] = await Promise.all([
          Promise.all(sortedRounds.map((round) => getAdminRoundGroupConfig(competitionId, round.id).catch(() => null))),
          getCompetitionConfirmedRegistrations(competitionId).catch(() => []),
        ]);

        if (!mounted) return;
        const next: Record<number, EditableGroup[]> = {};
        const nextModeByRound: Record<number, GroupNamingMode> = {};
        sortedRounds.forEach((round, index) => {
          const config = configs[index];
          const normalized = ensureFinalRoundDefaultGroup(round, config?.groups ?? []);
          next[round.id] = normalized;
          nextModeByRound[round.id] = 'number';
        });
        setGroupsByRound(next);
        setNamingModeByRound(nextModeByRound);
        setRegistrations(registrationData);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchConfigs();
    return () => {
      mounted = false;
    };
  }, [competitionId, sortedRounds]);

  useEffect(() => {
    if (sortedRounds.length === 0) return;
    setSelectedRoundId((prev) => {
      if (prev && sortedRounds.some((round) => round.id === prev)) return prev;
      return sortedRounds[0].id;
    });
  }, [sortedRounds]);

  const participantCountByRound = useMemo(() => {
    const countByRound: Record<number, number> = {};
    for (const round of sortedRounds) {
      const normalizedRoundEvent = normalizeEventName(round.eventName);
      countByRound[round.id] = registrations.filter((registration) => {
        const selectedEventSet = new Set((registration.selectedEvents ?? []).map((item) => normalizeEventName(item)));
        return selectedEventSet.size === 0 || selectedEventSet.has(normalizedRoundEvent);
      }).length;
    }
    return countByRound;
  }, [registrations, sortedRounds]);

  if (loading) {
    return <div className="card-list-empty">라운드 조 설정 정보를 불러오는 중...</div>;
  }

  if (sortedRounds.length === 0) {
    return <div className="card-list-empty">라운드가 없습니다.</div>;
  }

  const selectedRound = sortedRounds.find((round) => round.id === selectedRoundId) ?? sortedRounds[0];
  const selectedRoundGroups = ensureFinalRoundDefaultGroup(selectedRound, groupsByRound[selectedRound.id] ?? []);
  const selectedRoundParticipantCount = participantCountByRound[selectedRound.id] ?? 0;
  const recommendedPlayerCounts = distributePlayersByGroupCount(selectedRoundParticipantCount, selectedRoundGroups.length);
  const selectedNamingMode = namingModeByRound[selectedRound.id] ?? 'number';
  const customGroupName = customGroupNameByRound[selectedRound.id] ?? '';
  const isSaving = savingRoundIdx === selectedRound.id;

  return (
    <>
      <div className="admin-round-config-layout">
        <aside className="admin-round-config-sidebar">
          <div className="admin-round-config-sidebar-list">
            {sortedRounds.map((round) => {
              const currentGroups = ensureFinalRoundDefaultGroup(round, groupsByRound[round.id] ?? []);
              const participantCount = participantCountByRound[round.id] ?? 0;
              const selected = selectedRound.id === round.id;
              return (
                <button
                  type="button"
                  className={`admin-round-sidebar-item ${selected ? 'active' : ''}`}
                  key={round.id}
                  onClick={() => setSelectedRoundId(round.id)}
                >
                  <strong>
                    {round.eventName} {round.roundName}
                  </strong>
                  <span>참가자 {participantCount}명</span>
                  <span>조 {currentGroups.length}개</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="admin-round-config-card admin-round-config-detail">
          <header className="admin-round-config-head">
            <strong>
              {selectedRound.eventName} {selectedRound.roundName}
            </strong>
            <span className="admin-round-config-head-meta">
              참가자 {selectedRoundParticipantCount}명 · 조 {selectedRoundGroups.length}개
            </span>
          </header>

          <div className="admin-round-recommend-box">
            <span>
              추천 선수 정원:
              {recommendedPlayerCounts.length > 0 ? ` ${recommendedPlayerCounts.join(' / ')}` : ' 조를 먼저 추가하세요.'}
            </span>
            <button
              type="button"
              disabled={selectedRoundGroups.length === 0}
              onClick={() =>
                setGroupsByRound((prev) => ({
                  ...prev,
                  [selectedRound.id]: normalizeGroups(
                    selectedRoundGroups.map((group, index) => ({
                      ...group,
                      playerCount: recommendedPlayerCounts[index] ?? 0,
                    })),
                  ),
                }))
              }
            >
              추천 정원 적용
            </button>
          </div>

          <div className="admin-group-editor admin-group-editor--split">
            <select
              value={selectedNamingMode}
              onChange={(event) =>
                setNamingModeByRound((prev) => ({
                  ...prev,
                  [selectedRound.id]: event.target.value as GroupNamingMode,
                }))
              }
            >
              {Object.entries(GROUP_NAMING_MODE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              value={customGroupName}
              onChange={(event) =>
                setCustomGroupNameByRound((prev) => ({
                  ...prev,
                  [selectedRound.id]: event.target.value,
                }))
              }
              disabled={selectedNamingMode !== 'custom'}
              placeholder={
                selectedNamingMode === 'custom'
                  ? '커스텀 조 이름 입력'
                  : selectedNamingMode === 'number'
                    ? '숫자 자동 생성 (1, 2, 3...)'
                    : '영어 자동 생성 (A, B, C...)'
              }
            />
            <button
              type="button"
              onClick={() => {
                const sourceGroups = ensureFinalRoundDefaultGroup(selectedRound, groupsByRound[selectedRound.id] ?? []);
                const groupName =
                  selectedNamingMode === 'custom'
                    ? customGroupName.trim()
                    : selectedNamingMode === 'number'
                      ? getNextNumberGroupName(sourceGroups)
                      : getNextAlphaGroupName(sourceGroups);
                if (!groupName) return;
                setGroupsByRound((prev) => ({
                  ...prev,
                  [selectedRound.id]: normalizeGroups([
                    ...sourceGroups,
                    { groupName, playerCount: 0, judgeCount: 0, runnerCount: 0, scramblerCount: 0 },
                  ]),
                }));
                if (selectedNamingMode === 'custom') {
                  setCustomGroupNameByRound((prev) => ({ ...prev, [selectedRound.id]: '' }));
                }
              }}
            >
              +
            </button>
          </div>

          <div className="admin-player-table-wrap">
            <table className="admin-player-table">
              <thead>
                <tr>
                  <th>조 이름</th>
                  <th>선수 정원</th>
                  <th>심판 정원</th>
                  <th>러너 정원</th>
                  <th>스크램블러 정원</th>
                  <th>삭제</th>
                </tr>
              </thead>
              <tbody>
                {selectedRoundGroups.map((group, index) => (
                  <tr key={`${selectedRound.id}-${index}`}>
                    <td>
                      <input
                        className="admin-limit-input admin-limit-input-name"
                        value={group.groupName}
                        onChange={(event) => {
                          const value = event.target.value;
                          const nextGroups = selectedRoundGroups.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, groupName: value } : item,
                          );
                          setGroupsByRound((prev) => ({
                            ...prev,
                            [selectedRound.id]: nextGroups,
                          }));
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="admin-limit-input"
                        type="number"
                        min={0}
                        value={group.playerCount}
                        onChange={(event) => {
                          const value = Math.max(0, Number(event.target.value) || 0);
                          const nextGroups = selectedRoundGroups.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, playerCount: value } : item,
                          );
                          setGroupsByRound((prev) => ({
                            ...prev,
                            [selectedRound.id]: nextGroups,
                          }));
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="admin-limit-input"
                        type="number"
                        min={0}
                        value={group.judgeCount}
                        onChange={(event) => {
                          const value = Math.max(0, Number(event.target.value) || 0);
                          const nextGroups = selectedRoundGroups.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, judgeCount: value } : item,
                          );
                          setGroupsByRound((prev) => ({
                            ...prev,
                            [selectedRound.id]: nextGroups,
                          }));
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="admin-limit-input"
                        type="number"
                        min={0}
                        value={group.runnerCount}
                        onChange={(event) => {
                          const value = Math.max(0, Number(event.target.value) || 0);
                          const nextGroups = selectedRoundGroups.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, runnerCount: value } : item,
                          );
                          setGroupsByRound((prev) => ({
                            ...prev,
                            [selectedRound.id]: nextGroups,
                          }));
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="admin-limit-input"
                        type="number"
                        min={0}
                        value={group.scramblerCount}
                        onChange={(event) => {
                          const value = Math.max(0, Number(event.target.value) || 0);
                          const nextGroups = selectedRoundGroups.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, scramblerCount: value } : item,
                          );
                          setGroupsByRound((prev) => ({
                            ...prev,
                            [selectedRound.id]: nextGroups,
                          }));
                        }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-table-delete-btn"
                        onClick={() =>
                          setGroupsByRound((prev) => ({
                            ...prev,
                            [selectedRound.id]: selectedRoundGroups.filter((_, itemIndex) => itemIndex !== index),
                          }))
                        }
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
                {selectedRoundGroups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="admin-player-table-empty">
                      조가 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="admin-save-footer">
            <button
              type="button"
              disabled={isSaving}
              className="admin-save-all-btn"
              onClick={async () => {
                const groupsToSave = ensureFinalRoundDefaultGroup(selectedRound, groupsByRound[selectedRound.id] ?? []);
                try {
                  setSavingRoundIdx(selectedRound.id);
                  await updateAdminRoundGroupConfig(competitionId, selectedRound.id, groupsToSave);
                  setGroupsByRound((prev) => ({ ...prev, [selectedRound.id]: groupsToSave }));
                  setToast({
                    open: true,
                    message: `${selectedRound.eventName} ${selectedRound.roundName} 설정 저장 완료`,
                    variant: 'success',
                  });
                } catch (error) {
                  setToast({ open: true, message: `저장 실패: ${String(error)}`, variant: 'error' });
                } finally {
                  setSavingRoundIdx(null);
                }
              }}
            >
              {isSaving ? '저장 중...' : '이 라운드 저장'}
            </button>
          </div>
        </section>
      </div>

      <OverlayToast
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />
    </>
  );
};
