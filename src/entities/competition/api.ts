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
type ResetAssignmentsResponse = {
  data: {
    compIdx: number;
    competitionName: string;
    roundCount: number;
    deletedRows: number;
    reset: boolean;
  };
};
type AutoAssignResponse = {
  data: {
    compIdx: number;
    competitionName: string;
    requestInfo?: {
      scramblerCandidateCount: number;
      excludedRunnerJudgeCount: number;
    };
    rounds: Array<{
      roundIdx: number;
      eventName: string;
      roundName: string;
      groupCount: number;
      participantCount?: number;
      skipped?: boolean;
      reason?: string;
      playerAssigned?: number;
      playerRequested?: number;
      scramblerAssigned?: number;
      scramblerRequested?: number;
      runnerAssigned?: number;
      runnerRequested?: number;
      judgeAssigned?: number;
      judgeRequested?: number;
      adminFallbackUsed?: boolean;
    }>;
    inserted: {
      competition: number;
      scrambler: number;
      runner: number;
      judge: number;
    };
    needsManualAssignment?: boolean;
    manualAssignmentRoundCount?: number;
    manualAssignmentRounds?: Array<{
      roundIdx: number;
      eventName: string;
      roundName: string;
      reason: string;
    }>;
    autoAssigned: boolean;
  };
};

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
  const path = `/admin/competition/${competitionId}/round/${roundIdx}/config`;
  try {
    const response = await apiRequest<RoundConfigResponse>(path, {
      method: 'PUT',
      body: JSON.stringify({ groups }),
    });
    return response.data;
  } catch {
    const response = await apiRequest<RoundConfigResponse>(path, {
      method: 'POST',
      body: JSON.stringify({ groups }),
    });
    return response.data;
  }
};

export const resetCompetitionAssignments = async (
  competitionId: number,
  confirmCompetitionName: string,
): Promise<ResetAssignmentsResponse['data']> => {
  const candidatePaths = [
    `/admin/competition/${competitionId}/reset-assignments`,
    `/admin/competitions/${competitionId}/reset-assignments`,
    `/v1/admin/competition/${competitionId}/reset-assignments`,
  ];

  let lastError: unknown = null;
  for (const path of candidatePaths) {
    try {
      const response = await apiRequest<ResetAssignmentsResponse>(path, {
        method: 'POST',
        body: JSON.stringify({ confirmCompetitionName }),
      });
      return response.data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('reset-assignments failed');
};

export const autoAssignCompetition = async (
  competitionId: number,
  payload: {
    confirmCompetitionName: string;
    scramblerCandidateCckIds: string[];
    excludedCckIds: string[];
  },
): Promise<AutoAssignResponse['data']> => {
  const candidatePaths = [
    `/admin/competition/${competitionId}/auto-assign`,
    `/admin/competitions/${competitionId}/auto-assign`,
    `/v1/admin/competition/${competitionId}/auto-assign`,
  ];

  let lastError: unknown = null;
  for (const path of candidatePaths) {
    try {
      const response = await apiRequest<AutoAssignResponse>(path, {
        method: 'POST',
        body: JSON.stringify({
          confirmCompetitionName: payload.confirmCompetitionName,
          scramblerCandidateCckIds: payload.scramblerCandidateCckIds,
          scramblerCckIds: payload.scramblerCandidateCckIds,
          excludedCckIds: payload.excludedCckIds,
          scrambler: {
            candidateCckIds: payload.scramblerCandidateCckIds,
          },
          exclusion: {
            cckIds: payload.excludedCckIds,
          },
        }),
      });
      return response.data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('auto-assign failed');
};
