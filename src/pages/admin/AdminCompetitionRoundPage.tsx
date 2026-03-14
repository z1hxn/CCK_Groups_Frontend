import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getAdminRoundGroupConfig,
  getCompetitionConfirmedRegistrations,
  getCompetitionDetail,
  getCompetitionRoundAssignments,
  updateCompetitionPlayerAssignment,
} from '@/entities/competition/api';
import type {
  CompetitionDetail,
  CompetitionRoundAssignments,
  ConfirmedRegistration,
  PlayerRole,
  RoundGroupConfig,
} from '@/entities/competition/types';
import { isAdminByToken } from '@/shared/auth/tokenStorage';
import { OverlayConfirm, OverlayToast } from '@/widgets/overlay';
import { PageHeader } from '@/widgets/pageHeader/PageHeader';

type RoleItem = {
  role: PlayerRole;
  label: string;
  className: string;
};
type ViewRole = PlayerRole | 'all';
type RoleEntry = {
  role: PlayerRole;
  label: string;
  className: string;
  cckId: string;
  idx: number;
  group: string;
};

const roleItems: RoleItem[] = [
  { role: 'competition', label: '출전', className: 'role-player' },
  { role: 'judge', label: '심판', className: 'role-judge' },
  { role: 'runner', label: '러너', className: 'role-runner' },
  { role: 'scrambler', label: '스크램블러', className: 'role-scrambler' },
];

const toUniqueSortedGroups = (groups: string[]) => [...new Set(groups)].sort((a, b) => a.localeCompare(b, 'ko-KR'));
const normalizeGroupName = (value: string) => String(value || '').trim();
const normalizeEventName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '');
const roleLimitFieldByRole: Record<PlayerRole, keyof RoundGroupConfig['groups'][number]> = {
  competition: 'playerCount',
  judge: 'judgeCount',
  runner: 'runnerCount',
  scrambler: 'scramblerCount',
};

export const AdminCompetitionRoundPage = () => {
  const { compIdx, roundIdx } = useParams();
  const competitionId = Number(compIdx);
  const targetRoundIdx = Number(roundIdx);
  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [assignments, setAssignments] = useState<CompetitionRoundAssignments | null>(null);
  const [roundConfig, setRoundConfig] = useState<RoundGroupConfig | null>(null);
  const [nameByCckId, setNameByCckId] = useState<Record<string, string>>({});
  const [registrations, setRegistrations] = useState<ConfirmedRegistration[]>([]);
  const [activeGroup, setActiveGroup] = useState('');
  const [activeRole, setActiveRole] = useState<ViewRole>('all');
  const [query, setQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addRole, setAddRole] = useState<PlayerRole>('competition');
  const [addCckId, setAddCckId] = useState('');
  const [detailEntry, setDetailEntry] = useState<RoleEntry | null>(null);
  const [detailTargetGroup, setDetailTargetGroup] = useState('');
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: '',
    message: '',
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ open: boolean; message: string; variant: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    variant: 'info',
  });
  const confirmActionRef = useRef<null | (() => void)>(null);

  const loadData = async () => {
    if (!Number.isFinite(competitionId) || !Number.isFinite(targetRoundIdx)) return;

    const [competitionResult, assignmentResult, configResult, registrations] = await Promise.all([
      getCompetitionDetail(competitionId),
      getCompetitionRoundAssignments(targetRoundIdx),
      getAdminRoundGroupConfig(competitionId, targetRoundIdx),
      getCompetitionConfirmedRegistrations(competitionId),
    ]);

    setCompetition(competitionResult);
    setAssignments(assignmentResult);
    setRoundConfig(configResult);
    setRegistrations(registrations);
    setNameByCckId(
      Object.fromEntries(
        registrations.map((item) => [
          item.cckId.toLowerCase(),
          item.enName ? `${item.name} (${item.enName})` : item.name || item.cckId,
        ]),
      ),
    );
  };

  useEffect(() => {
    let mounted = true;
    const fetchAll = async () => {
      if (!Number.isFinite(competitionId) || !Number.isFinite(targetRoundIdx)) {
        setLoading(false);
        return;
      }
      try {
        await loadData();
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchAll();
    return () => {
      mounted = false;
    };
  }, [competitionId, targetRoundIdx]);

  const groupNames = useMemo(() => {
    if (!assignments) return [];

    const fromRound = assignments.round?.roundGroupList ?? [];
    const fromSummary = assignments.groups.map((item) => item.group);
    const fromRoles = roleItems.flatMap((roleItem) => assignments[roleItem.role].map((item) => item.group));
    const fromConfig = (roundConfig?.groups ?? []).map((item) => item.groupName);
    return toUniqueSortedGroups(
      [...fromRound, ...fromSummary, ...fromRoles, ...fromConfig].map((item) => normalizeGroupName(item)).filter(Boolean),
    );
  }, [assignments, roundConfig]);

  useEffect(() => {
    if (groupNames.length === 0) {
      setActiveGroup('');
      return;
    }
    if (!activeGroup || !groupNames.includes(activeGroup)) {
      setActiveGroup(groupNames[0]);
    }
  }, [activeGroup, groupNames]);

  useEffect(() => {
    if (detailEntry && groupNames.length > 0 && !groupNames.includes(detailTargetGroup)) {
      setDetailTargetGroup(detailEntry.group);
    }
  }, [detailEntry, detailTargetGroup, groupNames]);

  if (!isAdminByToken()) return <div className="empty-state">403 Forbidden</div>;
  if (loading) return <div className="empty-state">라운드 편집 정보 로딩 중...</div>;
  if (!competition || !assignments) return <div className="empty-state">라운드 정보를 불러올 수 없습니다.</div>;

  const participantSet = new Set(
    registrations
      .filter((item) => {
        const selected = Array.isArray(item.selectedEvents) ? item.selectedEvents : [];
        if (selected.length === 0) return true;
        return selected.map((value) => normalizeEventName(value)).includes(normalizeEventName(assignments.round?.cubeEventName ?? ''));
      })
      .map((item) => item.cckId.toLowerCase()),
  );

  const registrationOptions = [...registrations]
    .map((item) => ({
      cckId: item.cckId,
      label: item.enName ? `${item.name} (${item.enName})` : item.name || item.cckId,
      isParticipant: participantSet.has(item.cckId.toLowerCase()),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ko-KR'));

  const askConfirm = (title: string, message: string, action: () => void) => {
    confirmActionRef.current = action;
    setConfirm({ open: true, title, message });
  };

  const getCurrentRoleGroups = (role: PlayerRole, cckId: string) =>
    [...new Set((assignments[role] ?? []).filter((item) => item.cckId === cckId).map((item) => item.group))];

  const getRoleLimit = (role: PlayerRole, groupName: string) => {
    const field = roleLimitFieldByRole[role];
    const config = roundConfig?.groups?.find((item) => normalizeGroupName(item.groupName) === normalizeGroupName(groupName));
    return Number(config?.[field] || 0);
  };

  const validateLimit = (role: PlayerRole, groupName: string, cckId: string) => {
    const roleLimit = getRoleLimit(role, groupName);
    if (roleLimit <= 0) return { blocked: false, warn: false, roleLimit: 0 };
    const currentAssignedCount = (assignments[role] ?? []).filter(
      (item) => normalizeGroupName(item.group) === normalizeGroupName(groupName),
    ).length;
    const alreadyAssigned = (assignments[role] ?? []).some(
      (item) => item.cckId === cckId && normalizeGroupName(item.group) === normalizeGroupName(groupName),
    );
    const projectedCount = currentAssignedCount + (alreadyAssigned ? 0 : 1);
    if (projectedCount <= roleLimit) return { blocked: false, warn: false, roleLimit };
    if (role === 'competition') return { blocked: true, warn: false, roleLimit };
    return { blocked: false, warn: true, roleLimit };
  };

  const updateRoleGroups = async (role: PlayerRole, cckId: string, groupsToSave: string[], actionKey: string) => {
    setMutatingKey(actionKey);
    try {
      await updateCompetitionPlayerAssignment(competitionId, {
        cckId,
        role,
        roundIdx: targetRoundIdx,
        groups: groupsToSave,
      });
      await loadData();
      setToast({ open: true, message: '배정이 수정되었습니다.', variant: 'success' });
      return true;
    } catch (error) {
      setToast({ open: true, message: `배정 수정 실패: ${String(error)}`, variant: 'error' });
      return false;
    } finally {
      setMutatingKey(null);
    }
  };

  const roundTitle = assignments.round
    ? `${assignments.round.cubeEventName} ${assignments.round.roundName}`
    : `Round ${targetRoundIdx}`;

  const rowsByRole = roleItems.map((roleItem) => ({
    roleItem,
    rows: assignments[roleItem.role].filter((item) => normalizeGroupName(item.group) === activeGroup),
  }));
  const allEntries: RoleEntry[] = rowsByRole.flatMap(({ roleItem, rows }) =>
    rows.map((item) => ({
      role: roleItem.role,
      label: roleItem.label,
      className: roleItem.className,
      cckId: item.cckId,
      idx: item.idx,
      group: item.group,
    })),
  );
  const rowEntries: RoleEntry[] =
    activeRole === 'all'
      ? allEntries
      : rowsByRole
          .filter(({ roleItem }) => roleItem.role === activeRole)
          .flatMap(({ roleItem, rows }) =>
            rows.map((item) => ({
              role: roleItem.role,
              label: roleItem.label,
              className: roleItem.className,
              cckId: item.cckId,
              idx: item.idx,
              group: item.group,
            })),
          );
  const filteredRows = rowEntries.filter((entry) => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return true;
    const name = nameByCckId[entry.cckId.toLowerCase()] ?? entry.cckId;
    return name.toLowerCase().includes(keyword) || entry.cckId.toLowerCase().includes(keyword);
  });

  const openAddModal = () => {
    const defaultRole = activeRole === 'all' ? 'competition' : activeRole;
    setAddRole(defaultRole);
    setAddCckId('');
    setAddModalOpen(true);
  };

  const submitAdd = async () => {
    const role = addRole;
    const cckIdToAdd = addCckId.trim();
    if (!cckIdToAdd) return;

    const runAdd = async () => {
      const currentGroups = getCurrentRoleGroups(role, cckIdToAdd);
      const nextGroups = role === 'competition' ? [activeGroup] : toUniqueSortedGroups([...currentGroups, activeGroup]);
      const ok = await updateRoleGroups(role, cckIdToAdd, nextGroups, `add-${activeGroup}-${role}`);
      if (ok) setAddModalOpen(false);
    };

    const isParticipant = participantSet.has(cckIdToAdd.toLowerCase());
    if (!isParticipant) {
      askConfirm(
        '미참가 종목 예외 배정',
        role === 'competition'
          ? '이 선수는 해당 종목 미참가입니다. 즉석 신청/예외 출전으로 배정할까요?'
          : '이 선수는 해당 종목 미참가입니다. 스탭으로 예외 배정할까요?',
        () => void runAdd(),
      );
      return;
    }

    const limitCheck = validateLimit(role, activeGroup, cckIdToAdd);
    if (limitCheck.blocked) {
      setToast({
        open: true,
        variant: 'error',
        message: `${activeGroup}조 ${roleItems.find((item) => item.role === role)?.label ?? ''} 정원(${limitCheck.roleLimit})이 가득 찼습니다.`,
      });
      return;
    }
    if (limitCheck.warn) {
      askConfirm(
        '정원 초과 경고',
        `${activeGroup}조 ${roleItems.find((item) => item.role === role)?.label ?? ''} 정원(${limitCheck.roleLimit})을 초과합니다. 계속 배정할까요?`,
        () => void runAdd(),
      );
      return;
    }
    await runAdd();
  };

  return (
    <div className="comp-page">
      <PageHeader
        containerClassName="comp-header"
        title={roundTitle}
        subtitle={
          <>
            <span>{competition.name}</span>
            <span className="page-title-meta-divider">·</span>
            <span>라운드 관리</span>
          </>
        }
        actions={[
          {
            label: '대회 관리',
            to: `/admin/competition/${competitionId}?view=round`,
            iconSrc: '/icon/button/back.svg',
          },
        ]}
      />

      <div className="comp-content admin-content">
        {groupNames.length === 0 ? (
          <div className="round-role-empty">표시할 조가 없습니다.</div>
        ) : (
          <div className="round-group-manage-wrap">
            <div className="comp-view-tabs">
              {groupNames.map((groupName) => (
                <button
                  key={groupName}
                  type="button"
                  className={`comp-view-tab ${activeGroup === groupName ? 'active' : ''}`}
                  onClick={() => setActiveGroup(groupName)}
                >
                  {groupName}조
                </button>
              ))}
            </div>

            <section className="round-group-card">
              <header className="round-group-header">
                <h3>{activeGroup}조</h3>
              </header>
              <div className="round-role-tab-list">
                <button
                  key="admin-role-tab-all"
                  type="button"
                  className={`round-role-tab role-all ${activeRole === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveRole('all')}
                >
                  전체 ({allEntries.length})
                </button>
                {roleItems.map((roleItem) => {
                  const count = rowsByRole.find((item) => item.roleItem.role === roleItem.role)?.rows.length ?? 0;
                  const limit = getRoleLimit(roleItem.role, activeGroup);
                  return (
                    <button
                      key={`admin-role-tab-${roleItem.role}`}
                      type="button"
                      className={`round-role-tab ${roleItem.className} ${activeRole === roleItem.role ? 'active' : ''}`}
                      onClick={() => setActiveRole(roleItem.role)}
                    >
                      {roleItem.label} ({limit > 0 ? `${count}/${limit}` : `${count}`})
                    </button>
                  );
                })}
              </div>

              <div className="round-role-tools">
                <div className="round-role-search">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="이름 또는 CCK ID 검색"
                  />
                </div>
                <button type="button" className="round-role-plus-btn" onClick={openAddModal}>
                  + 추가
                </button>
              </div>

              <div className="round-role-list">
                {filteredRows.length === 0 ? (
                  <span className="round-role-empty">배정 없음</span>
                ) : (
                  filteredRows.map((entry) => (
                    <button
                      key={`admin-row-${entry.role}-${entry.idx}`}
                      type="button"
                      className="round-role-list-item admin-round-role-list-item"
                      onClick={() => {
                        setDetailEntry(entry);
                        setDetailTargetGroup(normalizeGroupName(entry.group));
                      }}
                    >
                      <span className={`player-role-badge ${entry.className}`}>{entry.label}</span>
                      <span>{nameByCckId[entry.cckId.toLowerCase()] ?? entry.cckId}</span>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      <OverlayConfirm
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmLabel="계속 진행"
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
      {addModalOpen ? (
        <div className="overlay-confirm-backdrop" role="presentation" onClick={() => setAddModalOpen(false)}>
          <div className="overlay-confirm-card admin-round-add-card" onClick={(event) => event.stopPropagation()}>
            <h3>배정 추가</h3>
            <div className="admin-round-detail-row">
              <span>조</span>
              <strong>{activeGroup}조</strong>
            </div>
            <div className="admin-round-detail-row">
              <span>역할</span>
              <select
                value={addRole}
                onChange={(event) => setAddRole(event.target.value as PlayerRole)}
                disabled={activeRole !== 'all'}
              >
                {roleItems.map((item) => (
                  <option key={`add-role-${item.role}`} value={item.role}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-round-detail-row">
              <span>선수</span>
              <select value={addCckId} onChange={(event) => setAddCckId(event.target.value)}>
                <option value="">선수 선택</option>
                {registrationOptions.map((option) => (
                  <option key={`add-option-${option.cckId}`} value={option.cckId}>
                    {option.label}
                    {option.isParticipant ? '' : ' · 미참가'}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-round-detail-actions">
              <button
                type="button"
                className="admin-save-all-btn"
                disabled={mutatingKey === `add-${activeGroup}-${addRole}` || !addCckId.trim()}
                onClick={() => void submitAdd()}
              >
                추가
              </button>
              <button type="button" className="admin-top-btn" onClick={() => setAddModalOpen(false)}>
                취소
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {detailEntry ? (
        <div className="overlay-confirm-backdrop" role="presentation" onClick={() => setDetailEntry(null)}>
          <div className="overlay-confirm-card admin-round-detail-card" onClick={(event) => event.stopPropagation()}>
            <h3>배정 상세</h3>
            <p>{nameByCckId[detailEntry.cckId.toLowerCase()] ?? detailEntry.cckId}</p>
            <div className="admin-round-detail-row">
              <span>역할</span>
              <span className={`player-role-badge ${detailEntry.className}`}>{detailEntry.label}</span>
            </div>
            <div className="admin-round-detail-row">
              <span>CCK ID</span>
              <strong>{detailEntry.cckId}</strong>
            </div>
            <div className="admin-round-detail-row">
              <span>조</span>
              <select value={detailTargetGroup} onChange={(event) => setDetailTargetGroup(event.target.value)}>
                {groupNames.map((groupName) => (
                  <option key={`detail-group-${groupName}`} value={groupName}>
                    {groupName}조
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-round-detail-actions">
              <button
                type="button"
                className="admin-save-all-btn"
                disabled={mutatingKey === `move-${detailEntry.role}-${detailEntry.cckId}-${detailEntry.group}`}
                onClick={async () => {
                  if (!detailTargetGroup || detailTargetGroup === normalizeGroupName(detailEntry.group)) return;
                  const runMove = async () => {
                    const currentGroups = getCurrentRoleGroups(detailEntry.role, detailEntry.cckId);
                    const nextGroups =
                      detailEntry.role === 'competition'
                        ? [detailTargetGroup]
                        : toUniqueSortedGroups([
                            ...currentGroups.filter((item) => item !== normalizeGroupName(detailEntry.group)),
                            detailTargetGroup,
                          ]);
                    const ok = await updateRoleGroups(
                      detailEntry.role,
                      detailEntry.cckId,
                      nextGroups,
                      `move-${detailEntry.role}-${detailEntry.cckId}-${detailEntry.group}`,
                    );
                    if (ok) setDetailEntry(null);
                  };
                  const limitCheck = validateLimit(detailEntry.role, detailTargetGroup, detailEntry.cckId);
                  if (limitCheck.blocked) {
                    setToast({
                      open: true,
                      variant: 'error',
                      message: `${detailTargetGroup}조 ${detailEntry.label} 정원(${limitCheck.roleLimit})이 가득 찼습니다.`,
                    });
                    return;
                  }
                  if (limitCheck.warn) {
                    askConfirm(
                      '정원 초과 경고',
                      `${detailTargetGroup}조 ${detailEntry.label} 정원(${limitCheck.roleLimit})을 초과합니다. 계속 이동할까요?`,
                      () => void runMove(),
                    );
                    return;
                  }
                  await runMove();
                }}
              >
                변경
              </button>
              <button
                type="button"
                className="admin-table-delete-btn"
                disabled={mutatingKey === `remove-${detailEntry.role}-${detailEntry.cckId}-${detailEntry.group}`}
                onClick={async () => {
                  const currentGroups = getCurrentRoleGroups(detailEntry.role, detailEntry.cckId);
                  const nextGroups = currentGroups.filter((group) => group !== normalizeGroupName(detailEntry.group));
                  const ok = await updateRoleGroups(
                    detailEntry.role,
                    detailEntry.cckId,
                    nextGroups,
                    `remove-${detailEntry.role}-${detailEntry.cckId}-${detailEntry.group}`,
                  );
                  if (ok) setDetailEntry(null);
                }}
              >
                제거
              </button>
              <button type="button" className="admin-top-btn" onClick={() => setDetailEntry(null)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <OverlayToast
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
};
