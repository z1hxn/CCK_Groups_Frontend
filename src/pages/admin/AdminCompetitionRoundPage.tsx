import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getAdminRoundGroupConfig,
  getCompetitionConfirmedRegistrations,
  getCompetitionDetail,
  getCompetitionRoundAssignments,
  updateAdminRoundGroupConfig,
} from '@/entities/competition/api';
import type { CompetitionDetail, CompetitionRoundAssignments, PlayerRole, RoundGroupConfig } from '@/entities/competition/types';
import { isAdminByToken } from '@/shared/auth/tokenStorage';
import { OverlayToast } from '@/widgets/overlay';
import { PageHeader } from '@/widgets/pageHeader/PageHeader';

type RoleItem = {
  role: PlayerRole;
  label: string;
  className: string;
};

type EditableRoundGroup = RoundGroupConfig['groups'][number];

const roleItems: RoleItem[] = [
  { role: 'competition', label: '선수', className: 'role-player' },
  { role: 'judge', label: '심판', className: 'role-judge' },
  { role: 'runner', label: '러너', className: 'role-runner' },
  { role: 'scrambler', label: '스크램블러', className: 'role-scrambler' },
];

const normalizeRoundGroups = (groups: EditableRoundGroup[]) => {
  const map = new Map<string, EditableRoundGroup>();
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
  return [...map.values()].sort((a, b) => a.groupName.localeCompare(b.groupName, 'ko-KR'));
};

export const AdminCompetitionRoundPage = () => {
  const { compIdx, roundIdx } = useParams();
  const competitionId = Number(compIdx);
  const targetRoundIdx = Number(roundIdx);
  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [assignments, setAssignments] = useState<CompetitionRoundAssignments | null>(null);
  const [nameByCckId, setNameByCckId] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<EditableRoundGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; variant: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    variant: 'info',
  });

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
    setGroups(normalizeRoundGroups(configResult.groups || []));
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

  const mergedGroups = useMemo(() => {
    const assignedGroups = (assignments?.groups ?? []).map((item) => item.group);
    const merged = [
      ...groups,
      ...assignedGroups.map((groupName) => ({
        groupName,
        playerCount: 0,
        judgeCount: 0,
        runnerCount: 0,
        scramblerCount: 0,
      })),
    ];
    return normalizeRoundGroups(merged);
  }, [assignments?.groups, groups]);

  if (!isAdminByToken()) return <div className="empty-state">403 Forbidden</div>;
  if (loading) return <div className="empty-state">라운드 편집 정보 로딩 중...</div>;
  if (!competition || !assignments) return <div className="empty-state">라운드 정보를 불러올 수 없습니다.</div>;

  const roundTitle = assignments.round
    ? `${assignments.round.cubeEventName} ${assignments.round.roundName}`
    : `Round ${targetRoundIdx}`;

  return (
    <div className="comp-page">
      <PageHeader
        containerClassName="comp-header"
        title={roundTitle}
        subtitle={
          <>
            <span>{competition.name}</span>
            <span className="page-title-meta-divider">·</span>
            <span>라운드별 편집</span>
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
          <h3>라운드 조 설정</h3>
          <div className="admin-group-editor">
            <input
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              placeholder="새 조 이름 입력"
            />
            <button
              type="button"
              onClick={() => {
                const groupName = newGroupName.trim();
                if (!groupName) return;
                setGroups((prev) =>
                  normalizeRoundGroups([
                    ...prev,
                    { groupName, playerCount: 0, judgeCount: 0, runnerCount: 0, scramblerCount: 0 },
                  ]),
                );
                setNewGroupName('');
              }}
            >
              조 추가
            </button>
          </div>

          <div className="admin-player-table-wrap">
            <table className="admin-player-table">
              <thead>
                <tr>
                  <th>조</th>
                  <th>선수 정원</th>
                  <th>심판 정원</th>
                  <th>러너 정원</th>
                  <th>스크램 정원</th>
                  <th>삭제</th>
                </tr>
              </thead>
              <tbody>
                {mergedGroups.map((group) => (
                  <tr key={group.groupName}>
                    <td>{group.groupName}조</td>
                    <td>
                      <input
                        className="admin-limit-input"
                        type="number"
                        min={0}
                        value={group.playerCount}
                        onChange={(event) => {
                          const value = Math.max(0, Number(event.target.value) || 0);
                          setGroups((prev) =>
                            normalizeRoundGroups(
                              prev.map((item) =>
                                item.groupName === group.groupName ? { ...item, playerCount: value } : item,
                              ),
                            ),
                          );
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
                          setGroups((prev) =>
                            normalizeRoundGroups(
                              prev.map((item) =>
                                item.groupName === group.groupName ? { ...item, judgeCount: value } : item,
                              ),
                            ),
                          );
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
                          setGroups((prev) =>
                            normalizeRoundGroups(
                              prev.map((item) =>
                                item.groupName === group.groupName ? { ...item, runnerCount: value } : item,
                              ),
                            ),
                          );
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
                          setGroups((prev) =>
                            normalizeRoundGroups(
                              prev.map((item) =>
                                item.groupName === group.groupName ? { ...item, scramblerCount: value } : item,
                              ),
                            ),
                          );
                        }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-table-delete-btn"
                        onClick={() => setGroups((prev) => prev.filter((item) => item.groupName !== group.groupName))}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
                {mergedGroups.length === 0 ? (
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
              disabled={saving}
              className="admin-save-all-btn"
              onClick={async () => {
                setSaving(true);
                try {
                  await updateAdminRoundGroupConfig(competitionId, targetRoundIdx, mergedGroups);
                  await loadData();
                  setToast({ open: true, message: '라운드 조 설정이 저장되었습니다.', variant: 'success' });
                } catch (error) {
                  setToast({ open: true, message: `저장 실패: ${String(error)}`, variant: 'error' });
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? '저장 중...' : '라운드 조 설정 저장'}
            </button>
          </div>
        </section>

        <section className="admin-panel">
          <h3>현재 배정 현황</h3>
          {mergedGroups.length === 0 ? (
            <div className="round-role-empty">표시할 조가 없습니다.</div>
          ) : (
            <div className="round-group-list">
              {mergedGroups.map((groupItem) => {
                const groupData = assignments.groups.find((item) => item.group === groupItem.groupName);
                return (
                  <section className="round-group-card" key={groupItem.groupName}>
                    <header className="round-group-header">
                      <h3>{groupItem.groupName}조</h3>
                    </header>
                    <div className="round-role-grid">
                      {roleItems.map((roleItem) => {
                        const roleRows = groupData?.[roleItem.role] ?? [];
                        return (
                          <div className="round-role-panel" key={`${groupItem.groupName}-${roleItem.role}`}>
                            <div className="round-role-panel-head">
                              <span className={`player-role-badge ${roleItem.className}`}>{roleItem.label}</span>
                              <span>{roleRows.length}명</span>
                            </div>
                            <div className="round-role-panel-body">
                              {roleRows.length === 0 ? (
                                <span className="round-role-empty">배정 없음</span>
                              ) : (
                                roleRows.map((assignment) => (
                                  <Link
                                    key={`${roleItem.role}-${assignment.idx}`}
                                    className="round-role-member"
                                    to={`/admin/competition/${competitionId}/player/${encodeURIComponent(assignment.cckId)}`}
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
                );
              })}
            </div>
          )}
        </section>
      </div>

      <OverlayToast
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
};
