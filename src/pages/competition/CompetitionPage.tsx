import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getCompetitionConfirmedRegistrations, getCompetitionDetail } from '@/entities/competition/api';
import type { CompetitionDetail, ConfirmedRegistration } from '@/entities/competition/types';
import { PageHeader } from '@/widgets/pageHeader/PageHeader.tsx';

const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatTime = (date: Date) => {
  const h = `${date.getHours()}`.padStart(2, '0');
  const m = `${date.getMinutes()}`.padStart(2, '0');
  return `${h}:${m}`;
};

const formatTimeRange = (start: string, end: string) => `${formatTime(new Date(start))} ~ ${formatTime(new Date(end))}`;

export const CompetitionPage = () => {
  const { compIdx } = useParams();
  const competitionId = Number(compIdx);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = searchParams.get('view') === 'round' ? 'round' : 'player';
  const [viewMode, setViewMode] = useState<'player' | 'round'>(initialView);

  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<ConfirmedRegistration[]>([]);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let mounted = true;

    const fetchCompetition = async () => {
      if (!Number.isFinite(competitionId)) {
        setLoading(false);
        return;
      }

      try {
        const result = await getCompetitionDetail(competitionId);
        if (!mounted) return;
        setCompetition(result);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchCompetition();
    return () => {
      mounted = false;
    };
  }, [competitionId]);

  useEffect(() => {
    let mounted = true;

    const fetchRegistrations = async () => {
      if (!Number.isFinite(competitionId)) return;
      setRegistrationLoading(true);

      try {
        const result = await getCompetitionConfirmedRegistrations(competitionId);
        if (!mounted) return;
        setRegistrations(result);
      } finally {
        if (mounted) setRegistrationLoading(false);
      }
    };

    fetchRegistrations();
    return () => {
      mounted = false;
    };
  }, [competitionId]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredRegistrations = useMemo(
    () =>
      registrations.filter((item) => {
        if (!normalizedQuery) return true;
        return (
          item.name.toLowerCase().includes(normalizedQuery) ||
          item.enName.toLowerCase().includes(normalizedQuery) ||
          item.cckId.toLowerCase().includes(normalizedQuery)
        );
      }),
    [registrations, normalizedQuery],
  );

  const rounds = useMemo(
    () =>
      competition?.rounds
        ? [...competition.rounds].sort((a, b) => new Date(a.eventStart).getTime() - new Date(b.eventStart).getTime())
        : [],
    [competition?.rounds],
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

  if (loading) return <div className="empty-state">대회 정보 로딩 중...</div>;
  if (!competition) return <div className="empty-state">대회 정보를 불러올 수 없습니다.</div>;

  return (
    <div className="comp-page comp-page-public">
      <PageHeader
        containerClassName="comp-header"
        title={competition.name}
        subtitle={
          <>
            <span>{formatDate(new Date(competition.dateStart))}</span>
            {competition.location ? (
              <>
                <span className="page-title-meta-divider">·</span>
                <span>{competition.location}</span>
              </>
            ) : null}
          </>
        }
        actions={[
          {
            label: 'Ranking 대회 페이지',
            href: `https://ranking.cubingclub.com/competition/${competitionId}`,
            iconSrc: '/icon/button/statistics.svg',
          },
          {
            label: 'Payment 대회 페이지',
            href: `https://payment.cubingclub.com/competitions/${competitionId}`,
            iconSrc: '/icon/button/payment.svg',
          },
        ]}
      />

      <div className="comp-content">
        <div className="comp-view-tabs">
          <button
            type="button"
            className={`comp-view-tab ${viewMode === 'player' ? 'active' : ''}`}
            onClick={() => updateViewMode('player')}
          >
            선수별 보기
          </button>
          <button
            type="button"
            className={`comp-view-tab ${viewMode === 'round' ? 'active' : ''}`}
            onClick={() => updateViewMode('round')}
          >
            라운드별 보기
          </button>
        </div>

        <div className="registration-panel">
          {viewMode === 'player' ? (
            <>
              <label className="search-bar" htmlFor="competition-registration-search">
                <span className="round-search-icon" aria-hidden="true">
                  <img src="/icon/sidebar/search.svg" alt="" aria-hidden="true" />
                </span>
                <input
                  className="search-bar-input"
                  id="competition-registration-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="이름, 영문 이름, CCK ID로 검색"
                />
              </label>

              <div className="registration-summary">
                총 <span>{registrations.length.toLocaleString('ko-KR')}</span>명
                {normalizedQuery ? (
                  <>
                    {' '}
                    · 검색 결과 <span>{filteredRegistrations.length.toLocaleString('ko-KR')}</span>명
                  </>
                ) : null}
              </div>

              {registrationLoading ? <div className="empty-state">참가자 목록 로딩 중...</div> : null}

              {!registrationLoading ? (
                <div className="registration-list">
                  {filteredRegistrations.length === 0 ? (
                    <div className="card-list-empty">조건에 맞는 참가자가 없습니다.</div>
                  ) : (
                    filteredRegistrations.map((item) => (
                      <Link
                        className="registration-row registration-row-link"
                        key={item.id}
                        to={`/competition/${competitionId}/player/${encodeURIComponent(item.cckId)}`}
                      >
                        <div className="registration-line">
                          <strong>{item.name}</strong>
                          <span>{item.cckId}</span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="registration-summary">
                총 <span>{rounds.length.toLocaleString('ko-KR')}</span>개 라운드
              </div>

              <div className="registration-list">
                {rounds.length === 0 ? (
                  <div className="card-list-empty">라운드가 없습니다.</div>
                ) : (
                  rounds.map((round) => (
                    <Link
                      className="registration-row registration-row-link round-list-link"
                      key={round.id}
                      to={`/competition/${competitionId}/round/${round.id}`}
                    >
                      <div className="round-list-line">
                        <strong>
                          {round.eventName} {round.roundName}
                        </strong>
                        <span>{formatTimeRange(round.eventStart, round.eventEnd)}</span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
