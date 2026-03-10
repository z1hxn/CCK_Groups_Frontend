import { Link } from 'react-router-dom';
import type { Round, RoundDayCount } from '@/entities/competition/types';

type RoundListProps = {
  schedule: RoundDayCount | null;
  loading: boolean;
  selectedDate: Date | null;
  competitionId: number;
};

type RoundStatus = 'past' | 'now' | 'future';

type RoundItem = {
  round: Round;
  status: RoundStatus;
};

const formatTime = (date: Date) => {
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
};

const formatTimeRange = (start: Date, end: Date) => `${formatTime(start)} ~ ${formatTime(end)}`;

const getMetaText = (round: Round) => {
  const parts: string[] = [];
  const isFinal = round.roundName.toLowerCase().includes('final');

  if (round.advance) {
    if (isFinal) parts.push(`상위 ${round.advance}명에 대해 수상이 진행됩니다`);
    else parts.push(`상위 ${round.advance}명이 다음 라운드로 진출합니다`);
  }

  return parts.length > 0 ? parts.join(' · ') : '라운드 정보';
};

const toItems = (rounds: Round[], status: RoundStatus): RoundItem[] => rounds.map((round) => ({ round, status }));

const isOverlappingDate = (start: Date, end: Date, selectedDate: Date) => {
  const dayStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0);
  const dayEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1, 0, 0, 0, 0);
  return start < dayEnd && end > dayStart;
};

export const RoundList = ({ schedule, loading, selectedDate, competitionId }: RoundListProps) => {
  if (loading) return <div className="round-list-empty">라운드 로딩 중...</div>;
  if (!schedule) return <div className="round-list-empty">라운드 정보를 불러올 수 없습니다.</div>;

  const items = [...toItems(schedule.past, 'past'), ...toItems(schedule.now, 'now'), ...toItems(schedule.future, 'future')]
    .filter(({ round }) => (selectedDate ? isOverlappingDate(new Date(round.eventStart), new Date(round.eventEnd), selectedDate) : true))
    .sort((a, b) => new Date(a.round.eventStart).getTime() - new Date(b.round.eventStart).getTime());

  if (items.length === 0) return <div className="round-list-empty">해당 날짜에 라운드가 없습니다.</div>;

  return (
    <div className="round-list">
      {items.map(({ round, status }) => {
        const start = new Date(round.eventStart);
        const end = new Date(round.eventEnd);

        return (
          <Link className={`round-card ${status} round-card-link`} key={round.id} to={`/competition/${competitionId}`}>
            <div className="round-card-main">
              <div className="round-card-icon" aria-hidden="true">
                <img className="round-card-icon-img" src="/vite.svg" alt="" loading="lazy" />
              </div>
              <div className="round-card-body">
                <div className="round-card-title">
                  {round.eventName} {round.roundName}
                </div>
                <div className="round-card-meta">{getMetaText(round)}</div>
                <div className="round-card-meta-mobile-time">{formatTimeRange(start, end)}</div>
              </div>
            </div>
            <div className={`round-card-time ${status}`}>{formatTimeRange(start, end)}</div>
          </Link>
        );
      })}
    </div>
  );
};
