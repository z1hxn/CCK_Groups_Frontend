import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getCompetitionConfirmedRegistrations, getCompetitionDetail } from '@/entities/competition/api';
import type { CompetitionDetail, ConfirmedRegistration } from '@/entities/competition/types';
import { isAdminByToken } from '@/shared/auth/tokenStorage';
import { PageHeader } from '@/widgets/pageHeader/PageHeader';

export const AdminCompetitionPage = () => {
  const navigate = useNavigate();
  const { compIdx } = useParams();
  const competitionId = Number(compIdx);
  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [registrations, setRegistrations] = useState<ConfirmedRegistration[]>([]);
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'player' | 'round'>('player');
  const [loading, setLoading] = useState(true);

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
            item.cckId.toLowerCase().includes(keyword) ||
            item.name.toLowerCase().includes(keyword) ||
            item.enName.toLowerCase().includes(keyword)
          );
        })
        .sort((a, b) => a.label.localeCompare(b.label, 'ko-KR')),
    [registrations, query],
  );

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
            <span>관리자 페이지</span>
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
              onClick={() => setViewMode('player')}
            >
              선수별 조 편집
            </button>
            <button
              type="button"
              className={`comp-view-tab ${viewMode === 'round' ? 'active' : ''}`}
              onClick={() => setViewMode('round')}
            >
              라운드별 조 편집
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
          <button type="button" className="admin-top-btn" onClick={() => navigate(`/admin/competition/${competitionId}/auto`)}>
            자동 조편성
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
            <h3>라운드별 조 편집</h3>
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
                        <span>라운드 인원/역할 편집</span>
                      </div>
                    </Link>
                  ))
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
