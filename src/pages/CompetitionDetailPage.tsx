import { getCompetitionDetail } from '@/entities/competition/api';
import { useEffect, useState } from 'react';
import type { Competition } from '@/entities/competition/types';

type CompetitionDetailPageProps = {
  competitionId: number;
};

const formatPeriod = (start: string, end: string) => (start === end ? start : `${start} - ${end}`);

export const CompetitionDetailPage = ({ competitionId }: CompetitionDetailPageProps) => {
  const [loading, setLoading] = useState(true);
  const [competition, setCompetition] = useState<Competition | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const result = await getCompetitionDetail(competitionId);
        if (cancelled) return;
        setCompetition(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [competitionId]);

  if (loading) return <div className="empty-state">대회 상세 정보를 불러오는 중...</div>;
  if (!competition) return <div className="empty-state">대회 정보를 찾을 수 없습니다.</div>;

  return (
    <section className="detail-page">
      <div className="detail-head">
        <h1>{competition.name}</h1>
      </div>

      <div className="detail-panel">
        <div className="detail-row">
          <span>대회 ID</span>
          <strong>{competition.id}</strong>
        </div>
        <div className="detail-row">
          <span>기간</span>
          <strong>{formatPeriod(competition.dateStart, competition.dateEnd)}</strong>
        </div>
        <div className="detail-row">
          <span>장소</span>
          <strong>{competition.location || '장소 미정'}</strong>
        </div>
      </div>

      <a className="back-link" href="/">
        목록으로 돌아가기
      </a>
    </section>
  );
};
