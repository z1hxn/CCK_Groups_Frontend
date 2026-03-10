import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getCompetitionConfirmedRegistrations, getCompetitionDetail } from '@/entities/competition/api';
import type { CompetitionDetail, ConfirmedRegistration } from '@/entities/competition/types';
import { PageHeader } from '@/widgets/pageHeader/PageHeader.tsx';

const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatCurrency = (value: number) => `${value.toLocaleString('ko-KR')}원`;

export const CompetitionPage = () => {
  const { compIdx } = useParams();
  const competitionId = Number(compIdx);

  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<ConfirmedRegistration[]>([]);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [mocked, setMocked] = useState(false);

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
        setCompetition(result.data);
        setMocked(result.mocked);
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
        setRegistrations(result.data);
        setMocked((prev) => prev || result.mocked);
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

  if (loading) return <div className="empty-state">대회 정보 로딩 중...</div>;
  if (!competition) return <div className="empty-state">대회 정보를 불러올 수 없습니다.</div>;

  return (
    <div className="comp-page">
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
            label: 'Ranking으로 이동',
            href: `https://ranking.cubingclub.com/competition/${competitionId}`,
          },
          {
            label: 'Payment으로 이동',
            href: `https://payment.cubingclub.com/competition/${competitionId}`,
          },
        ]}
      />
      {mocked ? <small className="mock-chip">API 오류로 샘플 데이터 표시 중</small> : null}

      <div className="comp-content">
        <div className="registration-panel">
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
                  <div className="registration-row" key={item.id}>
                    <div className="registration-row-main">
                      <div className="registration-name-row">
                        <strong>{item.name}</strong>
                        <span>{item.enName}</span>
                      </div>
                      <p>{item.cckId}</p>
                    </div>
                    <div className="registration-row-side">
                      <p>{item.selectedEvents.join(', ') || '선택 종목 없음'}</p>
                      <span>{formatCurrency(item.totalFee)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
