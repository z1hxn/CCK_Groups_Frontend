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
  const [addingRole, setAddingRole] = useState<PlayerRole | null>(null);
  const [selectedAddByKey, setSelectedAddByKey] = useState<Record<string, string>>({});
  const [selectedEditGroupByKey, setSelectedEditGroupByKey] = useState<Record<string, string>>({});
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
    } catch (error) {
      setToast({ open: true, message: `배정 수정 실패: ${String(error)}`, variant: 'error' });
    } finally {
      setMutatingKey(null);
    }
  };

  const roundTitle = assignments.round
    ? `${assignments.round.cubeEventName} ${assignments.round.roundName}`
    : `Round ${targetRoundIdx}`;

  const activeGroupRoleRows = roleItems.map((roleItem) => ({
    roleItem,
    rows: assignments[roleItem.role].filter((item) => normalizeGroupName(item.group) === activeGroup),
  }));

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
            label: '대회관리',
            to: `/admin/competition/${competitionId}`,
            iconSrc: '/icon/button/back.svg',
          },
        ]}
      />

      <div className="comp-content admin-content">
        <section className="admin-panel">
          <h3>조별 역할 배정 관리</h3>
          {groupNames.length === 0 ? (
            <div className="round-role-empty">표시할 조가 없습니다.</div>
          ) : (
            <div className="round-group-manage-wrap">
              <div className="round-group-tabs">
                {groupNames.map((groupName) => (
                  <button
                    key={groupName}
                    type="button"
                    className={`round-group-tab ${activeGroup === groupName ? 'active' : ''}`}
                    onClick={() => {
                      setActiveGroup(groupName);
                      setAddingRole(null);
                    }}
                  >
                    {groupName}조
                  </button>
                ))}
              </div>

              <section className="round-group-card">
                <header className="round-group-header">
                  <h3>{activeGroup}조</h3>
                </header>
                <div className="round-role-grid">
                  {activeGroupRoleRows.map(({ roleItem, rows }) => {
                    const limit = getRoleLimit(roleItem.role, activeGroup);
                    return (
                      <div className="round-role-panel" key={`${activeGroup}-${roleItem.role}`}>
                        <div className="round-role-panel-head">
                          <span className={`player-role-badge ${roleItem.className}`}>{roleItem.label}</span>
                          <div className="round-role-panel-head-right">
                            <span>{limit > 0 ? `${rows.length}/${limit}명` : `${rows.length}명`}</span>
                            <button
                              type="button"
                              className="round-role-plus-btn"
                              onClick={() => setAddingRole((prev) => (prev === roleItem.role ? null : roleItem.role))}
                            >
                              + 추가
                            </button>
                          </div>
                        </div>
                        <div className="round-role-panel-body">
                          {rows.length === 0 ? (
                            <span className="round-role-empty">배정 없음</span>
                          ) : (
                            rows.map((assignment) => (
                              <div key={`${roleItem.role}-${assignment.idx}`} className="round-role-member-edit-row">
                                <span className="round-role-member">
                                  {nameByCckId[assignment.cckId.toLowerCase()] ?? assignment.cckId}
                                </span>
                                <select
                                  value={selectedEditGroupByKey[`${roleItem.role}-${assignment.idx}`] ?? activeGroup}
                                  onChange={(event) =>
                                    setSelectedEditGroupByKey((prev) => ({
                                      ...prev,
                                      [`${roleItem.role}-${assignment.idx}`]: event.target.value,
                                    }))
                                  }
                                >
                                  {groupNames.map((item) => (
                                    <option key={`${roleItem.role}-${assignment.idx}-${item}`} value={item}>
                                      {item}조
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="admin-save-all-btn round-role-add-btn"
                                  disabled={mutatingKey === `move-${roleItem.role}-${assignment.cckId}-${activeGroup}`}
                                  onClick={async () => {
                                    const targetGroup = selectedEditGroupByKey[`${roleItem.role}-${assignment.idx}`] ?? activeGroup;
                                    if (!targetGroup || targetGroup === activeGroup) return;
                                    const runMove = async () => {
                                      const currentGroups = getCurrentRoleGroups(roleItem.role, assignment.cckId);
                                      const nextGroups =
                                        roleItem.role === 'competition'
                                          ? [targetGroup]
                                          : toUniqueSortedGroups([
                                              ...currentGroups.filter((item) => item !== activeGroup),
                                              targetGroup,
                                            ]);
                                      await updateRoleGroups(
                                        roleItem.role,
                                        assignment.cckId,
                                        nextGroups,
                                        `move-${roleItem.role}-${assignment.cckId}-${activeGroup}`,
                                      );
                                    };

                                    const limitCheck = validateLimit(roleItem.role, targetGroup, assignment.cckId);
                                    if (limitCheck.blocked) {
                                      setToast({
                                        open: true,
                                        variant: 'error',
                                        message: `${targetGroup}조 ${roleItem.label} 정원(${limitCheck.roleLimit})이 가득 찼습니다.`,
                                      });
                                      return;
                                    }
                                    if (limitCheck.warn) {
                                      askConfirm(
                                        '정원 초과 경고',
                                        `${targetGroup}조 ${roleItem.label} 정원(${limitCheck.roleLimit})을 초과합니다. 계속 이동할까요?`,
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
                                  disabled={mutatingKey === `remove-${roleItem.role}-${assignment.cckId}-${activeGroup}`}
                                  onClick={async () => {
                                    const currentGroups = getCurrentRoleGroups(roleItem.role, assignment.cckId);
                                    const nextGroups = currentGroups.filter((group) => group !== activeGroup);
                                    await updateRoleGroups(
                                      roleItem.role,
                                      assignment.cckId,
                                      nextGroups,
                                      `remove-${roleItem.role}-${assignment.cckId}-${activeGroup}`,
                                    );
                                  }}
                                >
                                  제거
                                </button>
                              </div>
                            ))
                          )}

                          {addingRole === roleItem.role ? (
                            <div className="round-role-edit-controls">
                              <select
                                value={selectedAddByKey[`${activeGroup}-${roleItem.role}`] ?? ''}
                                onChange={(event) =>
                                  setSelectedAddByKey((prev) => ({
                                    ...prev,
                                    [`${activeGroup}-${roleItem.role}`]: event.target.value,
                                  }))
                                }
                              >
                                <option value="">선수 선택</option>
                                {registrationOptions.map((option) => (
                                  <option key={`${activeGroup}-${roleItem.role}-${option.cckId}`} value={option.cckId}>
                                    {option.label}
                                    {option.isParticipant ? '' : ' · 미참가'}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="admin-save-all-btn round-role-add-btn"
                                disabled={
                                  mutatingKey === `add-${activeGroup}-${roleItem.role}` ||
                                  !(selectedAddByKey[`${activeGroup}-${roleItem.role}`] ?? '').trim()
                                }
                                onClick={async () => {
                                  const cckIdToAdd = (selectedAddByKey[`${activeGroup}-${roleItem.role}`] ?? '').trim();
                                  if (!cckIdToAdd) return;

                                  const runAdd = async () => {
                                    const currentGroups = getCurrentRoleGroups(roleItem.role, cckIdToAdd);
                                    const nextGroups =
                                      roleItem.role === 'competition'
                                        ? [activeGroup]
                                        : toUniqueSortedGroups([...currentGroups, activeGroup]);
                                    await updateRoleGroups(
                                      roleItem.role,
                                      cckIdToAdd,
                                      nextGroups,
                                      `add-${activeGroup}-${roleItem.role}`,
                                    );
                                    setSelectedAddByKey((prev) => ({
                                      ...prev,
                                      [`${activeGroup}-${roleItem.role}`]: '',
                                    }));
                                    setAddingRole(null);
                                  };

                                  const isParticipant = participantSet.has(cckIdToAdd.toLowerCase());
                                  if (roleItem.role === 'competition' && !isParticipant) {
                                    setToast({
                                      open: true,
                                      variant: 'error',
                                      message: '미참가 종목 선수는 출전으로 배정할 수 없습니다.',
                                    });
                                    return;
                                  }
                                  if (roleItem.role !== 'competition' && !isParticipant) {
                                    askConfirm(
                                      '미참가 종목 예외 배정',
                                      '이 선수는 해당 종목 미참가입니다. 스탭으로 예외 배정할까요?',
                                      () => void runAdd(),
                                    );
                                    return;
                                  }

                                  const limitCheck = validateLimit(roleItem.role, activeGroup, cckIdToAdd);
                                  if (limitCheck.blocked) {
                                    setToast({
                                      open: true,
                                      variant: 'error',
                                      message: `${activeGroup}조 ${roleItem.label} 정원(${limitCheck.roleLimit})이 가득 찼습니다.`,
                                    });
                                    return;
                                  }
                                  if (limitCheck.warn) {
                                    askConfirm(
                                      '정원 초과 경고',
                                      `${activeGroup}조 ${roleItem.label} 정원(${limitCheck.roleLimit})을 초과합니다. 계속 배정할까요?`,
                                      () => void runAdd(),
                                    );
                                    return;
                                  }
                                  await runAdd();
                                }}
                              >
                                추가
                              </button>
                              <button type="button" className="admin-top-btn" onClick={() => setAddingRole(null)}>
                                취소
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </section>
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
      <OverlayToast
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
};
