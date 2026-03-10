import { useEffect, useState } from 'react';
import CompList, { type CompListItem } from './components/CompList';
import { getCompetitions } from '@/entities/competition/api';

export const MainPage = () => {
  const [upcoming, setUpcoming] = useState<CompListItem[]>([]);
  const [ongoing, setOngoing] = useState<CompListItem[]>([]);
  const [ended, setEnded] = useState<CompListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mocked, setMocked] = useState(false);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isSameDate = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  const formatMeta = (startDate: Date, endDate: Date, location?: string) => {
    const base = isSameDate(startDate, endDate)
      ? formatDate(startDate)
      : `${formatDate(startDate)} ~ ${formatDate(endDate)}`;
    return location ? `${base} · ${location}` : base;
  };

  const getDDay = (date: Date) => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = Math.ceil((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return `D-${Math.max(diff, 0)}`;
  };

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [future, now, past] = await Promise.all([
          getCompetitions('future'),
          getCompetitions('now'),
          getCompetitions('past'),
        ]);

        if (!mounted) return;

        setMocked(future.mocked || now.mocked || past.mocked);

        setUpcoming(
          future.data.map((item) => ({
            title: item.name,
            meta: formatMeta(new Date(item.dateStart), new Date(item.dateEnd), item.location),
            badge: getDDay(new Date(item.dateStart)),
            href: `/competition/${item.id}`,
          })),
        );

        setOngoing(
          now.data.map((item) => ({
            title: item.name,
            meta: formatMeta(new Date(item.dateStart), new Date(item.dateEnd), item.location),
            badge: '진행 중',
            variant: 'ongoing',
            href: `/competition/${item.id}`,
          })),
        );

        setEnded(
          past.data.map((item) => ({
            title: item.name,
            meta: formatMeta(new Date(item.dateStart), new Date(item.dateEnd), item.location),
            badge: '종료',
            variant: 'ended',
            href: `/competition/${item.id}`,
          })),
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="empty-state">대회 목록 로딩 중...</div>;

  return (
    <div className="main-page">
      {mocked ? <small className="mock-chip">API 오류로 샘플 데이터 표시 중</small> : null}
      <div className="main-section">
        <h2 className="main-section-title">다가오는 대회</h2>
        <CompList items={upcoming} emptyText="다가오는 대회가 없습니다." />
      </div>
      <div className="main-section">
        <h2 className="main-section-title">진행중인 대회</h2>
        <CompList items={ongoing} emptyText="진행중인 대회가 없습니다." />
      </div>
      <div className="main-section">
        <h2 className="main-section-title">지나간 대회</h2>
        <CompList items={ended} emptyText="지나간 대회가 없습니다." />
      </div>
    </div>
  );
};
