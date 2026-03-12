import { apiRequest } from '@/shared/api/client';
import type {
  Competition,
  CompetitionDetail,
  CompetitionPlayerAssignments,
  CompetitionRoundAssignments,
  CompetitionStatus,
  ConfirmedRegistration,
  RoundGroupConfig,
  RoundDayCount,
} from './types';

type ListResponse = { status: CompetitionStatus; data: Competition[] };
type DetailResponse = { data: CompetitionDetail };
type RoundDayResponse = { data: RoundDayCount };
type ConfirmedRegistrationResponse = { data: ConfirmedRegistration[] };
type UpdatePlayerAssignmentRequest = {
  cckId: string;
  role: 'competition' | 'judge' | 'runner' | 'scrambler';
  roundIdx: number;
  groups: string[];
};
type RoundConfigResponse = { data: RoundGroupConfig };

export const getCompetitions = async (status: CompetitionStatus): Promise<Competition[]> => {
  const response = await apiRequest<ListResponse>(`/competitions?status=${status}`);
  return response.data;
};

export const getCompetitionDetail = async (competitionId: number): Promise<CompetitionDetail | null> => {
  const response = await apiRequest<DetailResponse>(`/competitions/${competitionId}`);
  return response.data;
};

export const getCompetitionRoundsByDay = async (
  competitionId: number,
  dayCount: number,
): Promise<RoundDayCount> => {
  const response = await apiRequest<RoundDayResponse>(`/competitions/${competitionId}/rounds/day/${dayCount}`);
  return response.data;
};

export const getCompetitionConfirmedRegistrations = async (
  competitionId: number,
): Promise<ConfirmedRegistration[]> => {
  const response = await apiRequest<ConfirmedRegistrationResponse>(`/competitions/${competitionId}/registrations/confirmed`);
  return response.data;
};

export const getCompetitionPlayerAssignments = async (
  competitionId: number,
  cckId: string,
): Promise<CompetitionPlayerAssignments> => {
  return apiRequest<CompetitionPlayerAssignments>(`/v1/competition/${competitionId}/player/${encodeURIComponent(cckId)}`);
};

export const getCompetitionRoundAssignments = async (roundIdx: number): Promise<CompetitionRoundAssignments> => {
  return apiRequest<CompetitionRoundAssignments>(`/v1/round/${roundIdx}`);
};

export const updateCompetitionPlayerAssignment = async (
  competitionId: number,
  payload: UpdatePlayerAssignmentRequest,
): Promise<void> => {
  const candidatePaths = [
    `/admin/competition/${competitionId}/player-assignment`,
    `/admin/competitions/${competitionId}/player-assignment`,
    `/v1/admin/competition/${competitionId}/player-assignment`,
  ];

  let lastError: unknown = null;
  for (const path of candidatePaths) {
    try {
      await apiRequest(path, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('player-assignment update failed');
};

export const getAdminRoundGroupConfig = async (competitionId: number, roundIdx: number): Promise<RoundGroupConfig> => {
  const response = await apiRequest<RoundConfigResponse>(`/admin/competition/${competitionId}/round/${roundIdx}/config`);
  return response.data;
};

export const updateAdminRoundGroupConfig = async (
  competitionId: number,
  roundIdx: number,
  groups: Array<{
    groupName: string;
    playerCount: number;
    judgeCount: number;
    runnerCount: number;
    scramblerCount: number;
  }>,
): Promise<RoundGroupConfig> => {
  const response = await apiRequest<RoundConfigResponse>(`/admin/competition/${competitionId}/round/${roundIdx}/config`, {
    method: 'PUT',
    body: JSON.stringify({ groups }),
  });
  return response.data;
};
