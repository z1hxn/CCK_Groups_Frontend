import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getCompetitionDetail } from '@/entities/competition/api';
import type { CompetitionDetail } from '@/entities/competition/types';
import { AdminRoundGroupConfigEditorList } from '@/pages/admin/AdminRoundGroupConfigEditorList';
import { isAdminByToken } from '@/shared/auth/tokenStorage';
import { PageHeader } from '@/widgets/pageHeader/PageHeader';

export const AdminCompetitionGroupsPage = () => {
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
        <section className="admin-panel">
          <h3>라운드별 조 설정</h3>
          <AdminRoundGroupConfigEditorList competitionId={competitionId} rounds={rounds} />
        </section>
      </div>
    </div>
  );
};
