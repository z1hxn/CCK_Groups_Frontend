import { useEffect, useMemo, useState } from 'react';
import { getCompetitions } from '@/entities/competition/api';
import type { Competition, CompetitionStatus } from '@/entities/competition/types';

const STATUS_LABELS: Record<CompetitionStatus, string> = {
  now: '진행중',
  future: '예정',
  past: '종료',
};

const formatPeriod = (start: string, end: string) => (start === end ? start : `${start} - ${end}`);

export const MainPage = () => {
  const [status, setStatus] = useState<CompetitionStatus>('now');
  const [loading, setLoading] = useState(true);
  const [mocked, setMocked] = useState(false);
  const [items, setItems] = useState<Competition[]>([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const result = await getCompetitions(status);
        if (cancelled) return;
        setItems(result.data);
        setMocked(result.mocked);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const emptyText = useMemo(() => `${STATUS_LABELS[status]} 대회가 없습니다.`, [status]);

  return (
    <section className="main-page">
      <div className="main-page-head">
        <h1>CCK Groups 대회 목록</h1>
        <p>Ranking 스타일 기준으로 대회 목록과 상세 정보를 조회합니다.</p>
        {mocked ? <small className="mock-chip">실 API 실패로 샘플 데이터 표시 중</small> : null}
      </div>

      <div className="status-tabs">
        {(['now', 'future', 'past'] as CompetitionStatus[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`status-tab ${status === key ? 'active' : ''}`}
            onClick={() => setStatus(key)}
          >
            {STATUS_LABELS[key]}
          </button>
        ))}
      </div>

      {loading ? <div className="empty-state">대회 정보를 불러오는 중...</div> : null}

      {!loading && items.length === 0 ? (
        <div className="empty-state">{emptyText}</div>
      ) : (
        <div className="competition-list">
          {items.map((competition) => (
            <a key={competition.id} className="competition-row" href={`/competition/${competition.id}`}>
              <div className="competition-row-main">
                <strong>{competition.name}</strong>
                <span>{formatPeriod(competition.dateStart, competition.dateEnd)}</span>
              </div>
              <div className="competition-row-side">
                <span>{competition.location || '장소 미정'}</span>
                <span className="row-link">상세 보기</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
};
