import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  autoAssignCompetition,
  getAdminRoundGroupConfig,
  getCompetitionConfirmedRegistrations,
  getCompetitionDetail,
} from '@/entities/competition/api';
import type { CompetitionDetail, ConfirmedRegistration, Round } from '@/entities/competition/types';
import { isAdminByToken } from '@/shared/auth/tokenStorage';
import { OverlayToast } from '@/widgets/overlay';
import { PageHeader } from '@/widgets/pageHeader/PageHeader';

type AutoAssignResult = Awaited<ReturnType<typeof autoAssignCompetition>>;
type AutoAssignStep = 1 | 2 | 3 | 4 | 5;
type RoundSetupSummary = {
  roundId: number;
  label: string;
  participantCount: number;
  groupCount: number;
  totalPlayerCapacity: number;
  totalStaffCapacity: number;
  missingConfig: boolean;
  oneGroupFullPlayerRisk: boolean;
};

const normalizeEventName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '');
const STEP_LABELS: Array<{ step: AutoAssignStep; title: string; description: string }> = [
  { step: 1, title: '1단계', description: '현황 점검' },
  { step: 2, title: '2단계', description: '스크램블러 선택' },
  { step: 3, title: '3단계', description: '제외 인원 선택' },
  { step: 4, title: '4단계', description: '자동 배정 실행' },
  { step: 5, title: '5단계', description: '요약 확인' },
];

const getRoundLabel = (round: Round) => `${round.eventName} ${round.roundName}`;

export const AdminCompetitionAutoPage = () => {
  const navigate = useNavigate();
  const { compIdx } = useParams();
  const competitionId = Number(compIdx);
  const [step, setStep] = useState<AutoAssignStep>(1);
  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [registrations, setRegistrations] = useState<ConfirmedRegistration[]>([]);
  const [roundSetupSummaries, setRoundSetupSummaries] = useState<RoundSetupSummary[]>([]);
  const [scramblerQuery, setScramblerQuery] = useState('');
  const [excludeQuery, setExcludeQuery] = useState('');
  const [selectedScramblers, setSelectedScramblers] = useState<string[]>([]);
  const [excludedAutoAssignCckIds, setExcludedAutoAssignCckIds] = useState<string[]>([]);
  const [executing, setExecuting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AutoAssignResult | null>(null);
  const [toast, setToast] = useState<{ open: boolean; message: string; variant: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    variant: 'info',
  });

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      if (!Number.isFinite(competitionId)) {
        setLoading(false);
        return;
      }
      try {
        const [competitionResult, registrationResult] = await Promise.all([
          getCompetitionDetail(competitionId),
          getCompetitionConfirmedRegistrations(competitionId),
        ]);
        if (!mounted) return;
        setCompetition(competitionResult);
        setRegistrations(registrationResult);

        if (competitionResult) {
          const configs = await Promise.all(
            competitionResult.rounds.map((round) => getAdminRoundGroupConfig(competitionId, round.id).catch(() => null)),
          );
          if (!mounted) return;

          const summaries = competitionResult.rounds.map((round, index) => {
            const configGroups = configs[index]?.groups ?? [];
            const totalPlayerCapacity = configGroups.reduce((sum, group) => sum + (Number(group.playerCount) || 0), 0);
            const totalStaffCapacity = configGroups.reduce(
              (sum, group) =>
                sum + (Number(group.judgeCount) || 0) + (Number(group.runnerCount) || 0) + (Number(group.scramblerCount) || 0),
              0,
            );
            const participantCount = registrationResult.filter((registration) => {
              const eventSet = new Set((registration.selectedEvents ?? []).map((item) => normalizeEventName(item)));
              return eventSet.size === 0 || eventSet.has(normalizeEventName(round.eventName));
            }).length;
            const groupCount = configGroups.length;
            return {
              roundId: round.id,
              label: getRoundLabel(round),
              participantCount,
              groupCount,
              totalPlayerCapacity,
              totalStaffCapacity,
              missingConfig: groupCount === 0,
              oneGroupFullPlayerRisk:
                groupCount === 1 && participantCount > 0 && totalStaffCapacity > 0 && totalPlayerCapacity >= participantCount,
            };
          });
          setRoundSetupSummaries(summaries);
        } else {
          setRoundSetupSummaries([]);
        }
      } catch {
        if (mounted) {
          setToast({ open: true, variant: 'error', message: '자동 조편성 초기 데이터를 불러오지 못했습니다.' });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    return () => {
      mounted = false;
    };
  }, [competitionId]);

  const selectedSet = useMemo(() => new Set(selectedScramblers.map((item) => item.toLowerCase())), [selectedScramblers]);
  const excludedSet = useMemo(
    () => new Set(excludedAutoAssignCckIds.map((item) => item.toLowerCase())),
    [excludedAutoAssignCckIds],
  );

  const participantRows = useMemo(
    () =>
      registrations
        .map((item) => ({
          ...item,
          normalizedCckId: item.cckId.toLowerCase(),
          label: item.enName ? `${item.name} (${item.enName})` : item.name || item.cckId,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'ko-KR')),
    [registrations],
  );
  const scramblerRows = useMemo(() => {
    const keyword = scramblerQuery.trim().toLowerCase();
    if (!keyword) return participantRows;
    return participantRows.filter(
      (item) =>
        item.label.toLowerCase().includes(keyword) ||
        item.normalizedCckId.includes(keyword) ||
        item.selectedEvents.some((eventName) => eventName.toLowerCase().includes(keyword)),
    );
  }, [participantRows, scramblerQuery]);
  const exclusionRows = useMemo(() => {
    const keyword = excludeQuery.trim().toLowerCase();
    if (!keyword) return participantRows;
    return participantRows.filter(
      (item) =>
        item.label.toLowerCase().includes(keyword) ||
        item.normalizedCckId.includes(keyword) ||
        item.selectedEvents.some((eventName) => eventName.toLowerCase().includes(keyword)),
    );
  }, [participantRows, excludeQuery]);

  const missingConfigRounds = useMemo(
    () => roundSetupSummaries.filter((round) => round.missingConfig),
    [roundSetupSummaries],
  );
  const oneGroupFullRounds = useMemo(
    () => roundSetupSummaries.filter((round) => round.oneGroupFullPlayerRisk),
    [roundSetupSummaries],
  );
  const totalGroupCount = useMemo(
    () => roundSetupSummaries.reduce((sum, round) => sum + round.groupCount, 0),
    [roundSetupSummaries],
  );
  const configuredRoundCount = useMemo(
    () => roundSetupSummaries.filter((round) => !round.missingConfig).length,
    [roundSetupSummaries],
  );

  const deficitRoundsFromResult = useMemo(() => {
    if (!result) return [];
    if (Array.isArray(result.manualAssignmentRounds) && result.manualAssignmentRounds.length > 0) {
      return result.manualAssignmentRounds;
    }
    return result.rounds
      .filter((round) => {
        const scramblerAssigned = Number(round.scramblerAssigned || 0);
        const scramblerRequested = Number(round.scramblerRequested || 0);
        const runnerAssigned = Number(round.runnerAssigned || 0);
        const runnerRequested = Number(round.runnerRequested || 0);
        const judgeAssigned = Number(round.judgeAssigned || 0);
        const judgeRequested = Number(round.judgeRequested || 0);
        return (
          round.skipped === true ||
          scramblerAssigned < scramblerRequested ||
          runnerAssigned < runnerRequested ||
          judgeAssigned < judgeRequested
        );
      })
      .map((round) => ({
        roundIdx: round.roundIdx,
        eventName: round.eventName,
        roundName: round.roundName,
        reason: round.reason || '스탭 정원 미충족',
      }));
  }, [result]);
  const adminFallbackRounds = useMemo(
    () => (result?.rounds ?? []).filter((round) => round.adminFallbackUsed === true),
    [result],
  );

  const runAutoAssignment = async () => {
    if (!competition) return;
    if (missingConfigRounds.length > 0) {
      setStep(1);
      setToast({ open: true, variant: 'error', message: '조 설정이 누락된 라운드가 있어 자동 조편성을 시작할 수 없습니다.' });
      return;
    }
    if (oneGroupFullRounds.length > 0) {
      setStep(1);
      setToast({
        open: true,
        variant: 'error',
        message: '단일 조 + 출전 정원 포화 라운드가 있어 자동 조편성을 시작할 수 없습니다. 조를 분할해 주세요.',
      });
      return;
    }
    if (selectedScramblers.length === 0) {
      setStep(2);
      setToast({
        open: true,
        variant: 'error',
        message: '스크램블러 후보가 0명입니다. 2단계에서 최소 1명 이상 선택해 주세요.',
      });
      return;
    }
    const confirmed = window.confirm(
      '자동 조편성을 실행하면 현재 대회의 기존 배정 데이터가 삭제되고 새로 생성됩니다. 계속할까요?',
    );
    if (!confirmed) return;

    setExecuting(true);
    setStep(4);
    try {
      const response = await autoAssignCompetition(competitionId, {
        confirmCompetitionName: competition.name,
        scramblerCandidateCckIds: selectedScramblers,
        excludedCckIds: excludedAutoAssignCckIds,
      });
      setResult(response);
      setStep(5);
      if ((response.requestInfo?.scramblerCandidateCount ?? 0) === 0 && selectedScramblers.length > 0) {
        setToast({
          open: true,
          variant: 'error',
          message: '서버가 스크램블러 후보를 0명으로 인식했습니다. 백엔드 재시작 후 다시 시도해 주세요.',
        });
        return;
      }
      setToast({ open: true, variant: 'success', message: '자동 조편성이 완료되었습니다.' });
    } catch (error) {
      setStep(3);
      setToast({ open: true, variant: 'error', message: `자동 배정 실패: ${String(error)}` });
    } finally {
      setExecuting(false);
    }
  };

  if (!isAdminByToken()) return <div className="empty-state">403 Forbidden</div>;
  if (!Number.isFinite(competitionId)) return <div className="empty-state">잘못된 접근입니다.</div>;
  if (loading) return <div className="empty-state">자동 조편성 데이터 로딩 중...</div>;
  if (!competition) return <div className="empty-state">대회 정보를 불러올 수 없습니다.</div>;

  return (
    <div className="comp-page">
      <PageHeader
        containerClassName="comp-header"
        title="자동 조편성"
        subtitle={
          <>
            <span>{competition.name}</span>
            <span className="page-title-meta-divider">·</span>
            <span>스크램블러 후보/제외 인원 설정 후 실행</span>
          </>
        }
        actions={[
          {
            label: '대회 관리',
            to: `/admin/competition/${competitionId}`,
            iconSrc: '/icon/button/back.svg',
          },
        ]}
      />

      <div className="comp-content admin-content">
        <section className="admin-panel">
          <div className="admin-auto-stepper">
            {STEP_LABELS.map((item) => (
              <div
                key={item.step}
                className={`admin-auto-step ${step === item.step ? 'active' : ''} ${step > item.step ? 'done' : ''}`}
              >
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </div>
            ))}
          </div>
        </section>

        {step === 1 ? (
          <section className="admin-panel">
            <h3>자동 조편성 안내</h3>
            <p className="admin-reset-warning-text">자동 조편성은 기존 배정 데이터를 초기화한 뒤 다시 생성합니다.</p>

            <div className="admin-auto-result-grid">
              <div className="admin-auto-result-card">
                <strong>전체 참가자</strong>
                <span>{registrations.length}</span>
              </div>
              <div className="admin-auto-result-card">
                <strong>라운드 수</strong>
                <span>{competition.rounds.length}</span>
              </div>
              <div className="admin-auto-result-card">
                <strong>설정된 라운드</strong>
                <span>{configuredRoundCount}</span>
              </div>
              <div className="admin-auto-result-card">
                <strong>총 조 개수</strong>
                <span>{totalGroupCount}</span>
              </div>
            </div>

            {missingConfigRounds.length > 0 ? (
              <div className="admin-warning-box">
                <strong>조 설정 누락 라운드가 있습니다. 먼저 조 설정을 완료하세요.</strong>
                {missingConfigRounds.map((round) => (
                  <span key={`missing-${round.roundId}`}>{round.label}</span>
                ))}
              </div>
            ) : null}

            {oneGroupFullRounds.length > 0 ? (
              <div className="admin-warning-box">
                <strong>1개 조에 출전 정원이 몰린 라운드가 있습니다. 조를 분할하세요.</strong>
                {oneGroupFullRounds.map((round) => (
                  <span key={`one-group-full-${round.roundId}`}>
                    {round.label} · 참가자 {round.participantCount}명 / 출전정원 {round.totalPlayerCapacity}명
                  </span>
                ))}
              </div>
            ) : null}

            <div className="admin-round-detail-actions">
              <button
                type="button"
                className="admin-save-all-btn"
                disabled={missingConfigRounds.length > 0 || oneGroupFullRounds.length > 0}
                onClick={() => setStep(2)}
              >
                다음 단계
              </button>
              <button
                type="button"
                className="admin-top-btn"
                onClick={() => navigate(`/admin/competition/${competitionId}/groups`)}
              >
                조 설정 페이지로 이동
              </button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
        <section className="admin-panel">
          <h3>스크램블러 후보 선택</h3>

          <div className="admin-auto-toolbar">
            <div className="admin-player-picker">
              <input
                value={scramblerQuery}
                onChange={(event) => setScramblerQuery(event.target.value)}
                placeholder="스크램블러 후보 검색 (이름 / CCK ID / 종목)"
              />
            </div>
            <div className="admin-auto-actions">
              <button
                type="button"
                className="admin-top-btn"
                onClick={() =>
                  setSelectedScramblers((prev) =>
                    [...new Set([...prev.map((item) => item.toLowerCase()), ...scramblerRows.map((item) => item.normalizedCckId)])],
                  )
                }
              >
                필터 전체 선택
              </button>
              <button
                type="button"
                className="admin-top-btn"
                onClick={() =>
                  setSelectedScramblers((prev) =>
                    prev.filter((cckId) => !scramblerRows.some((row) => row.normalizedCckId === cckId)),
                  )
                }
              >
                필터 선택 해제
              </button>
              <button type="button" className="admin-top-btn" onClick={() => setSelectedScramblers([])}>
                전체 해제
              </button>
            </div>
            <div className="admin-player-table-wrap">
              <table className="admin-player-table">
                <thead>
                  <tr>
                    <th>선택</th>
                    <th>이름</th>
                    <th>CCK ID</th>
                    <th>신청 종목</th>
                  </tr>
                </thead>
                <tbody>
                  {scramblerRows.map((item) => {
                    const checked = selectedSet.has(item.normalizedCckId);
                    return (
                      <tr key={`scrambler-${item.id}`}>
                        <td>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              setSelectedScramblers((prev) =>
                                event.target.checked
                                  ? [...new Set([...prev, item.normalizedCckId])]
                                  : prev.filter((cckId) => cckId !== item.normalizedCckId),
                              )
                            }
                          />
                        </td>
                        <td>{item.label}</td>
                        <td>{item.cckId}</td>
                        <td>{item.selectedEvents.length > 0 ? item.selectedEvents.join(', ') : '-'}</td>
                      </tr>
                    );
                  })}
                  {scramblerRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="admin-player-table-empty">
                        검색 결과가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-placeholder">
            <strong>선택된 Scrambler 후보</strong>
            <span>{selectedScramblers.length}명</span>
          </div>
          {selectedScramblers.length === 0 ? (
            <div className="admin-warning-box">
              <span>스크램블러 후보가 0명이면 자동조편성 시 스크램블러는 배정되지 않습니다.</span>
            </div>
          ) : null}

          <div className="admin-round-detail-actions">
            <button type="button" className="admin-top-btn" disabled={executing} onClick={() => setStep(1)}>
              이전 단계
            </button>
            <button
              type="button"
              className="admin-save-all-btn"
              disabled={executing || selectedScramblers.length === 0}
              onClick={() => setStep(3)}
            >
              다음 단계
            </button>
          </div>
        </section>
        ) : null}

        {step === 3 ? (
        <section className="admin-panel">
          <h3>자동배정 제외 인원 선택 (심판/러너 전용)</h3>

          <div className="admin-auto-toolbar">
            <div className="admin-player-picker">
              <input
                value={excludeQuery}
                onChange={(event) => setExcludeQuery(event.target.value)}
                placeholder="자동배정 제외 인원 검색 (이름 / CCK ID / 종목)"
              />
            </div>
            <div className="admin-auto-actions">
              <button
                type="button"
                className="admin-top-btn"
                onClick={() =>
                  setExcludedAutoAssignCckIds((prev) =>
                    [...new Set([...prev.map((item) => item.toLowerCase()), ...exclusionRows.map((item) => item.normalizedCckId)])],
                  )
                }
              >
                필터 제외
              </button>
              <button
                type="button"
                className="admin-top-btn"
                onClick={() =>
                  setExcludedAutoAssignCckIds((prev) =>
                    prev.filter((cckId) => !exclusionRows.some((row) => row.normalizedCckId === cckId)),
                  )
                }
              >
                필터 제외 해제
              </button>
              <button type="button" className="admin-top-btn" onClick={() => setExcludedAutoAssignCckIds([])}>
                전체 해제
              </button>
            </div>
            <div className="admin-player-table-wrap">
              <table className="admin-player-table">
                <thead>
                  <tr>
                    <th>제외</th>
                    <th>이름</th>
                    <th>CCK ID</th>
                    <th>신청 종목</th>
                  </tr>
                </thead>
                <tbody>
                  {exclusionRows.map((item) => (
                    <tr key={`exclude-${item.id}`}>
                      <td>
                        <input
                          type="checkbox"
                          checked={excludedSet.has(item.normalizedCckId)}
                          onChange={(event) =>
                            setExcludedAutoAssignCckIds((prev) =>
                              event.target.checked
                                ? [...new Set([...prev, item.normalizedCckId])]
                                : prev.filter((cckId) => cckId !== item.normalizedCckId),
                            )
                          }
                        />
                      </td>
                      <td>{item.label}</td>
                      <td>{item.cckId}</td>
                      <td>{item.selectedEvents.length > 0 ? item.selectedEvents.join(', ') : '-'}</td>
                    </tr>
                  ))}
                  {exclusionRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="admin-player-table-empty">
                        검색 결과가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-placeholder">
            <strong>자동배정 제외 인원 (심판/러너)</strong>
            <span>{excludedAutoAssignCckIds.length}명</span>
          </div>

          <div className="admin-round-detail-actions">
            <button type="button" className="admin-top-btn" disabled={executing} onClick={() => setStep(2)}>
              이전 단계
            </button>
            <button
              type="button"
              className="admin-save-all-btn"
              disabled={executing}
              onClick={() => {
                void runAutoAssignment();
              }}
            >
              자동 배정 시작
            </button>
          </div>
        </section>
        ) : null}

        {step === 4 ? (
          <section className="admin-panel">
            <h3>자동 조편성 실행 중</h3>
            <div className="admin-auto-loading">
              <div className="admin-auto-loading-dot" />
              <span>라운드별 배정 계산 및 저장을 진행하고 있습니다...</span>
            </div>
          </section>
        ) : null}

        {step === 5 && result ? (
          <section className="admin-panel">
            <h3>자동 조편성 결과 요약</h3>
            <div className="admin-auto-result-grid">
              <div className="admin-auto-result-card">
                <strong>출전</strong>
                <span>{result.inserted.competitor}</span>
              </div>
              <div className="admin-auto-result-card">
                <strong>스크램블러</strong>
                <span>{result.inserted.scrambler}</span>
              </div>
              <div className="admin-auto-result-card">
                <strong>러너</strong>
                <span>{result.inserted.runner}</span>
              </div>
              <div className="admin-auto-result-card">
                <strong>심판</strong>
                <span>{result.inserted.judge}</span>
              </div>
            </div>

            <div className="admin-placeholder">
              <strong>실행 시 사용된 스크램블러 후보</strong>
              <span>{result.requestInfo?.scramblerCandidateCount ?? selectedScramblers.length}명</span>
            </div>

            {deficitRoundsFromResult.length > 0 ? (
              <div className="admin-warning-box">
                <strong>일부 라운드에서 스탭 정원을 충족하지 못했습니다. 라운드 관리에서 일괄배정을 진행하세요.</strong>
                {deficitRoundsFromResult.map((round) => (
                  <span key={`manual-round-${round.roundIdx}`}>
                    {round.eventName} {round.roundName} · {round.reason}
                  </span>
                ))}
              </div>
            ) : (
              <div className="admin-placeholder">
                <strong>완료</strong>
                <span>모든 라운드에서 요청된 스탭 정원을 충족했습니다.</span>
              </div>
            )}

            {adminFallbackRounds.length > 0 ? (
              <div className="admin-info-box">
                <strong>조직위원 보정 배정이 사용되었습니다.</strong>
                {adminFallbackRounds.map((round) => (
                  <span key={`admin-fallback-${round.roundIdx}`}>
                    {round.eventName} {round.roundName}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="admin-player-table-wrap">
              <table className="admin-player-table">
                <thead>
                  <tr>
                    <th>라운드</th>
                    <th>출전</th>
                    <th>스크램블러</th>
                    <th>러너</th>
                    <th>심판</th>
                    <th>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rounds.map((round) => (
                    <tr key={`result-${round.roundIdx}`}>
                      {(() => {
                        const playerAssigned = Number(round.playerAssigned ?? 0);
                        const playerRequested = Number(round.playerRequested ?? 0);
                        const scramblerAssigned = Number(round.scramblerAssigned ?? 0);
                        const scramblerRequested = Number(round.scramblerRequested ?? 0);
                        const runnerAssigned = Number(round.runnerAssigned ?? 0);
                        const runnerRequested = Number(round.runnerRequested ?? 0);
                        const judgeAssigned = Number(round.judgeAssigned ?? 0);
                        const judgeRequested = Number(round.judgeRequested ?? 0);
                        return (
                          <>
                            <td>
                              {round.eventName} {round.roundName}
                            </td>
                            <td className={playerAssigned < playerRequested ? 'admin-auto-shortage' : ''}>
                              {playerAssigned}/{playerRequested}
                            </td>
                            <td className={scramblerAssigned < scramblerRequested ? 'admin-auto-shortage' : ''}>
                              {scramblerAssigned}/{scramblerRequested}
                            </td>
                            <td className={runnerAssigned < runnerRequested ? 'admin-auto-shortage' : ''}>
                              {runnerAssigned}/{runnerRequested}
                            </td>
                            <td className={judgeAssigned < judgeRequested ? 'admin-auto-shortage' : ''}>
                              {judgeAssigned}/{judgeRequested}
                            </td>
                            <td>{round.reason ?? (round.skipped ? '건너뜀' : '-')}</td>
                          </>
                        );
                      })()}
                    </tr>
                  ))}
                  {result.rounds.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="admin-player-table-empty">
                        결과 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="admin-round-detail-actions">
              <button
                type="button"
                className="admin-save-all-btn"
                onClick={() => {
                  setStep(2);
                }}
              >
                다시 실행
              </button>
              <button type="button" className="admin-top-btn" onClick={() => navigate(`/admin/competition/${competitionId}`)}>
                대회 관리로 이동
              </button>
            </div>
          </section>
        ) : null}
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
