import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getCompetitionDetail } from '@/entities/competition/api';
import type { CompetitionDetail } from '@/entities/competition/types';
import { isAdminByToken } from '@/shared/auth/tokenStorage';
import { PageHeader } from '@/widgets/pageHeader/PageHeader';

export const AdminCompetitionGroupsPage = () => {
  const navigate = useNavigate();
  const { compIdx } = useParams();
  const competitionId = Number(compIdx);
  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
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

    fetchData();
    return () => {
      mounted = false;
    };
  }, [competitionId]);

  const rounds = useMemo(
    () =>
      competition?.rounds
        ? [...competition.rounds].sort((a, b) => new Date(a.eventStart).getTime() - new Date(b.eventStart).getTime())
        : [],
    [competition?.rounds],
  );

  if (!isAdminByToken()) return <div className="empty-state">403 Forbidden</div>;
  if (loading) return <div className="empty-state">조 설정 페이지 로딩 중...</div>;
  if (!competition) return <div className="empty-state">대회 정보를 불러올 수 없습니다.</div>;

  return (
    <div className="comp-page">
      <PageHeader
        containerClassName="comp-header"
        title={competition.name}
        subtitle={
          <>
            <span>조 설정</span>
          </>
        }
        actions={[
          {
            label: '대회관리',
            to: `/admin/competition/${competitionId}`,
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
        <div className="admin-top-actions admin-top-actions-right">
          <button type="button" className="admin-top-btn admin-top-btn-active" onClick={() => navigate(`/admin/competition/${competitionId}/groups`)}>
            조 설정
          </button>
          <button type="button" className="admin-top-btn" onClick={() => navigate(`/admin/competition/${competitionId}/auto`)}>
            자동 조편성
          </button>
        </div>

        <section className="admin-panel">
          <h3>라운드별 조 설정</h3>
          <div className="registration-list">
            {rounds.length === 0 ? (
              <div className="card-list-empty">라운드가 없습니다.</div>
            ) : (
              rounds.map((round) => (
                <Link
                  key={round.id}
                  className="registration-row registration-row-link round-list-link"
                  to={`/admin/competition/${competitionId}/round/${round.id}`}
                >
                  <div className="round-list-line">
                    <strong>
                      {round.eventName} {round.roundName}
                    </strong>
                    <span>조 이름/정원 설정</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
