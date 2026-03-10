import { apiRequest } from '@/shared/api/client';
import type { Competition, CompetitionDetail, CompetitionStatus, ConfirmedRegistration, RoundDayCount } from './types';

type ListResponse = { status: CompetitionStatus; data: Competition[] };
type DetailResponse = { data: CompetitionDetail };
type RoundDayResponse = { data: RoundDayCount };
type ConfirmedRegistrationResponse = { data: ConfirmedRegistration[] };

const mockByStatus: Record<CompetitionStatus, Competition[]> = {
  now: [
    { id: 1, name: 'CCK Spring Open 2026', dateStart: '2026-04-18', dateEnd: '2026-04-19', location: 'Seoul' },
  ],
  future: [
    { id: 2, name: 'CCK Busan Cube Fest 2026', dateStart: '2026-05-09', dateEnd: '2026-05-10', location: 'Busan' },
  ],
  past: [
    { id: 3, name: 'CCK Winter Open 2025', dateStart: '2025-12-20', dateEnd: '2025-12-21', location: 'Daejeon' },
  ],
};

const mockDetail = (id: number): CompetitionDetail | null => {
  const all = [...mockByStatus.now, ...mockByStatus.future, ...mockByStatus.past];
  const found = all.find((item) => item.id === id);
  if (!found) return null;
  return {
    ...found,
    rounds: [
      {
        id: id * 100 + 1,
        competitionId: id,
        competitionName: found.name,
        eventName: '3x3x3',
        roundName: 'Round 1',
        eventStart: `${found.dateStart}T10:00:00`,
        eventEnd: `${found.dateStart}T11:30:00`,
        advance: 16,
      },
    ],
  };
};

export const getCompetitions = async (status: CompetitionStatus): Promise<{ data: Competition[]; mocked: boolean }> => {
  try {
    const response = await apiRequest<ListResponse>(`/competitions?status=${status}`);
    return { data: response.data, mocked: false };
  } catch {
    return { data: mockByStatus[status], mocked: true };
  }
};

export const getCompetitionDetail = async (competitionId: number): Promise<{ data: CompetitionDetail | null; mocked: boolean }> => {
  try {
    const response = await apiRequest<DetailResponse>(`/competitions/${competitionId}`);
    return { data: response.data, mocked: false };
  } catch {
    return { data: mockDetail(competitionId), mocked: true };
  }
};

export const getCompetitionRoundsByDay = async (
  competitionId: number,
  dayCount: number,
): Promise<{ data: RoundDayCount; mocked: boolean }> => {
  try {
    const response = await apiRequest<RoundDayResponse>(`/competitions/${competitionId}/rounds/day/${dayCount}`);
    return { data: response.data, mocked: false };
  } catch {
    const detail = mockDetail(competitionId);
    return {
      data: {
        past: [],
        now: detail?.rounds ?? [],
        future: [],
      },
      mocked: true,
    };
  }
};

export const getCompetitionConfirmedRegistrations = async (
  competitionId: number,
): Promise<{ data: ConfirmedRegistration[]; mocked: boolean }> => {
  try {
    const response = await apiRequest<ConfirmedRegistrationResponse>(`/competitions/${competitionId}/registrations/confirmed`);
    return { data: response.data, mocked: false };
  } catch {
    const detail = mockDetail(competitionId);
    return {
      data: detail
        ? [
            {
              id: competitionId * 1000 + 1,
              competitionId,
              competitionName: detail.name,
              name: '홍길동',
              enName: 'Gildong Hong',
              cckId: 'CCK00HONG01',
              selectedEvents: ['3x3x3'],
              totalFee: 20000,
              paymentStatus: 'PAID',
              registrationStatus: 'CONFIRMED',
              needRfCard: false,
            },
          ]
        : [],
      mocked: true,
    };
  }
};
