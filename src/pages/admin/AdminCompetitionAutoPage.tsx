import { useParams } from 'react-router-dom';
import { isAdminByToken } from '@/shared/auth/tokenStorage';
import { PageHeader } from '@/widgets/pageHeader/PageHeader';

export const AdminCompetitionAutoPage = () => {
  const { compIdx } = useParams();
  const competitionId = Number(compIdx);

  if (!isAdminByToken()) return <div className="empty-state">403 Forbidden</div>;
  if (!Number.isFinite(competitionId)) return <div className="empty-state">잘못된 접근입니다.</div>;

  return (
    <div className="comp-page">
      <PageHeader
        containerClassName="comp-header"
        title="자동 조편성"
        subtitle={
          <>
            <span>준비 중</span>
          </>
        }
        actions={[
          {
            label: '대회 관리',
            to: `/admin/competition/${competitionId}`,
            iconSrc: '/icon/button/back.svg',
          },
        ]}
      />

      <div className="comp-content admin-content">
        <section className="admin-panel">
          <h3>자동 조편성</h3>
          <div className="card-list-empty">아직 구현되지 않았습니다.</div>
        </section>
      </div>
    </div>
  );
};
