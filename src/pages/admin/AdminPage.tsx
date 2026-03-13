import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCompetitions } from '@/entities/competition/api';
import type { Competition } from '@/entities/competition/types';
import { isAdminByToken } from '@/shared/auth/tokenStorage';
import { PageHeader } from '@/widgets/pageHeader/PageHeader';

export const AdminPage = () => {
  const navigate = useNavigate();
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
    <div className="comp-page">
      <PageHeader
        containerClassName="comp-header"
        title="관리자 페이지"
        subtitle={
          <>
            <span>Group Admin Page</span>
          </>
        }
      />
      <div className="comp-content admin-content">
        <table className="admin-player-table">
          <thead>
            <tr>
              <th>대회명</th>
              <th>장소</th>
              <th>기간</th>
            </tr>
          </thead>
          <tbody>
            {uniqueCompetitions.map((competition) => (
              <tr
                key={competition.id}
                className="admin-player-table-row"
                onClick={() => navigate(`/admin/competition/${competition.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/admin/competition/${competition.id}`);
                  }
                }}
                tabIndex={0}
                role="button"
              >
                <td>{competition.name}</td>
                <td>{competition.location || '장소 미정'}</td>
                <td>
                  {competition.dateStart} ~ {competition.dateEnd}
                </td>
              </tr>
            ))}
            {uniqueCompetitions.length === 0 ? (
              <tr>
                <td colSpan={3} className="admin-player-table-empty">
                  대회가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
};
