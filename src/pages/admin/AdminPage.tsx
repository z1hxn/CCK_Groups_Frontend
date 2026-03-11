import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCompetitions } from '@/entities/competition/api';
import type { Competition } from '@/entities/competition/types';
import { isAdminByToken } from '@/shared/auth/tokenStorage';

export const AdminPage = () => {
  const [items, setItems] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      if (!isAdminByToken()) {
        setLoading(false);
        return;
      }

      try {
        const [future, now, past] = await Promise.all([
          getCompetitions('future'),
          getCompetitions('now'),
          getCompetitions('past'),
        ]);
        if (!mounted) return;
        setItems([...now, ...future, ...past]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, []);

  const uniqueCompetitions = useMemo(() => {
    const map = new Map<number, Competition>();
    for (const item of items) map.set(item.id, item);
    return [...map.values()].sort((a, b) => new Date(b.dateStart).getTime() - new Date(a.dateStart).getTime());
  }, [items]);

  if (!isAdminByToken()) return <div className="empty-state">403 Forbidden</div>;
  if (loading) return <div className="empty-state">관리자 페이지 로딩 중...</div>;

  return (
    <div className="main-page">
      <div className="main-section">
        <h2 className="main-section-title">관리자 페이지</h2>
        <div className="admin-competition-list">
          {uniqueCompetitions.map((competition) => (
            <Link key={competition.id} className="admin-competition-row" to={`/admin/competition/${competition.id}`}>
              <strong>{competition.name}</strong>
              <span>{competition.location || '장소 미정'}</span>
            </Link>
          ))}
          {uniqueCompetitions.length === 0 ? <div className="card-list-empty">대회가 없습니다.</div> : null}
        </div>
      </div>
    </div>
  );
};
