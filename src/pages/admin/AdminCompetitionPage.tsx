import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  getCompetitionConfirmedRegistrations,
  getCompetitionDetail,
  resetCompetitionAssignments,
} from '@/entities/competition/api';
import type { CompetitionDetail, ConfirmedRegistration } from '@/entities/competition/types';
import { normalizeCckId } from '@/shared/lib/cckId';
import { isAdminByToken } from '@/shared/auth/tokenStorage';
import { OverlayToast } from '@/widgets/overlay';
import { PageHeader } from '@/widgets/pageHeader/PageHeader';

export const AdminCompetitionPage = () => {
  const navigate = useNavigate();
  const { compIdx } = useParams();
  const competitionId = Number(compIdx);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = searchParams.get('view') === 'round' ? 'round' : 'player';
  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [registrations, setRegistrations] = useState<ConfirmedRegistration[]>([]);
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'player' | 'round'>(initialView);
  const [loading, setLoading] = useState(true);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState<'warning' | 'typing'>('warning');
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [resetting, setResetting] = useState(false);
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
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, [competitionId]);

  const rows = useMemo(
    () =>
      registrations
        .map((item) => ({
          ...item,
          label: item.enName ? `${item.name} (${item.enName})` : item.name,
        }))
        .filter((item) => {
          const keyword = query.trim().toLowerCase();
          if (!keyword) return true;
          return (
            item.label.toLowerCase().includes(keyword) ||
            normalizeCckId(item.cckId).toLowerCase().includes(keyword) ||
            item.name.toLowerCase().includes(keyword) ||
            item.enName.toLowerCase().includes(keyword)
          );
        })
        .sort((a, b) => a.label.localeCompare(b.label, 'ko-KR')),
    [registrations, query],
  );

  useEffect(() => {
    const queryView = searchParams.get('view');
    if (queryView === 'round' && viewMode !== 'round') setViewMode('round');
    if (queryView !== 'round' && viewMode !== 'player') setViewMode('player');
  }, [searchParams, viewMode]);

  const updateViewMode = (next: 'player' | 'round') => {
    setViewMode(next);
    setSearchParams(next === 'round' ? { view: 'round' } : {});
  };

  if (!isAdminByToken()) return <div className="empty-state">403 Forbidden</div>;
  if (loading) return <div className="empty-state">관리자 페이지 로딩 중...</div>;
  if (!competition) return <div className="empty-state">대회 정보를 불러올 수 없습니다.</div>;

  return (
    <div className="comp-page">
      <PageHeader
        containerClassName="comp-header"
        title={`${competition.name}`}
        subtitle={
          <>
            <span>대회 관리자 페이지</span>
          </>
        }
        actions={[
          {
            label: '관리자 목록',
            to: '/admin',
            iconSrc: '/icon/button/back.svg',
          },
          {
            label: '대회 페이지',
            to: `/competition/${competitionId}`,
            iconSrc: '/icon/button/home.svg',
          },
        ]}
      />

      <div className="comp-content admin-content">
        <div className="admin-control-bar">
          <div className="comp-view-tabs admin-view-tabs">
            <button
              type="button"
              className={`comp-view-tab ${viewMode === 'player' ? 'active' : ''}`}
              onClick={() => updateViewMode('player')}
            >
              선수별 관리
            </button>
            <button
              type="button"
              className={`comp-view-tab ${viewMode === 'round' ? 'active' : ''}`}
              onClick={() => updateViewMode('round')}
            >
              라운드 관리
            </button>
          </div>

          <div className="admin-top-actions">
            <button
              type="button"
              className="admin-top-btn"
              onClick={() => navigate(`/admin/competition/${competitionId}/groups`)}
            >
              조 설정
            </button>
            <button
              type="button"
              className="admin-top-btn"
              onClick={() => navigate(`/admin/competition/${competitionId}/auto`)}
            >
              자동 조편성
            </button>
            <button
              type="button"
              className="admin-top-btn admin-top-btn-danger"
              onClick={() => {
                setResetModalOpen(true);
                setResetStep('warning');
                setResetConfirmInput('');
              }}
            >
              모든 조편성 초기화
            </button>
          </div>
        </div>

        {viewMode === 'player' ? (
          <section className="admin-panel">
            <h3>선수별 조 편집</h3>
            <div className="admin-player-picker">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="이름 또는 CCK ID 검색"
              />
            </div>

            <div className="admin-player-table-wrap">
              <table className="admin-player-table">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>영문 이름</th>
                    <th>CCK ID</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr
                      key={item.id}
                      className="admin-player-table-row"
                      onClick={() =>
                        navigate(`/admin/competition/${competitionId}/player/${encodeURIComponent(item.cckId)}`)
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(`/admin/competition/${competitionId}/player/${encodeURIComponent(item.cckId)}`);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                    >
                      <td>{item.name || '-'}</td>
                      <td>{item.enName || '-'}</td>
                      <td>{item.cckId}</td>
                    </tr>
                  ))}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="admin-player-table-empty">
                        참가자가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="admin-panel">
            <h3>라운드 목록</h3>
            <div className="registration-list">
              {competition.rounds.length === 0 ? (
                <div className="card-list-empty">라운드가 없습니다.</div>
              ) : (
                [...competition.rounds]
                  .sort((a, b) => new Date(a.eventStart).getTime() - new Date(b.eventStart).getTime())
                  .map((round) => (
                    <Link
                      key={round.id}
                      className="registration-row registration-row-link round-list-link"
                      to={`/admin/competition/${competitionId}/round/${round.id}`}
                    >
                      <div className="round-list-line">
                        <strong>
                          {round.eventName} {round.roundName}
                        </strong>
                        <span>조별 출전/심판/러너/스크 관리</span>
                      </div>
                    </Link>
                  ))
              )}
            </div>
          </section>
        )}
      </div>

      {resetModalOpen ? (
        <div className="overlay-confirm-backdrop" role="presentation" onClick={() => !resetting && setResetModalOpen(false)}>
          <div className="overlay-confirm-card admin-reset-modal-card" onClick={(event) => event.stopPropagation()}>
            {resetStep === 'warning' ? (
              <>
                <h3>강력한 초기화 경고</h3>
                <p className="admin-reset-warning-text">
                  이 작업은 <strong>{competition.name}</strong>의 모든 조편성 데이터를 삭제합니다.
                </p>
                <p className="admin-reset-warning-text">삭제 후 복구할 수 없습니다. 계속하려면 다음 단계로 진행하세요.</p>
                <div className="admin-round-detail-actions">
                  <button
                    type="button"
                    className="admin-save-all-btn"
                    onClick={() => {
                      setResetStep('typing');
                      setResetConfirmInput('');
                    }}
                  >
                    다음
                  </button>
                  <button type="button" className="admin-top-btn" onClick={() => setResetModalOpen(false)}>
                    취소
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>최종 확인</h3>
                <p className="admin-reset-warning-text">
                  아래 입력칸에 대회명을 정확히 입력하세요: <strong>{competition.name}</strong>
                </p>
                <input
                  className="admin-reset-confirm-input"
                  value={resetConfirmInput}
                  onChange={(event) => setResetConfirmInput(event.target.value)}
                  placeholder="대회명 입력"
                />
                <div className="admin-round-detail-actions">
                  <button
                    type="button"
                    className="admin-save-all-btn"
                    disabled={resetting || resetConfirmInput.trim() !== competition.name}
                    onClick={async () => {
                      if (resetConfirmInput.trim() !== competition.name) return;
                      setResetting(true);
                      try {
                        await resetCompetitionAssignments(competitionId, resetConfirmInput.trim());
                        setResetModalOpen(false);
                        setToast({ open: true, variant: 'success', message: '모든 조편성이 초기화되었습니다.' });
                      } catch (error) {
                        setToast({ open: true, variant: 'error', message: `초기화 실패: ${String(error)}` });
                      } finally {
                        setResetting(false);
                      }
                    }}
                  >
                    {resetting ? '초기화 중...' : '모든 조편성 삭제'}
                  </button>
                  <button type="button" className="admin-top-btn" disabled={resetting} onClick={() => setResetStep('warning')}>
                    이전
                  </button>
                </div>
              </>
            )}
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
