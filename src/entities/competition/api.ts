import { apiRequest } from '@/shared/api/client';
import { getAccessToken } from '@/shared/auth/tokenStorage';
import { API_URL } from '@/shared/config';
import { normalizeCckId } from '@/shared/lib/cckId';
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
  role: 'competitor' | 'judge' | 'runner' | 'scrambler';
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
      competitor: number;
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
type BadgeExportRequest = {
  basePath: string;
  eventImages: Array<{
    eventCode: string;
    displayLabel: string;
    enablePath: string;
    disablePath: string;
  }>;
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
  size = 5000,
): Promise<ConfirmedRegistration[]> => {
  const response = await apiRequest<ConfirmedRegistrationResponse>(
    `/competitions/${competitionId}/registrations/confirmed?size=${size}`,
  );
  return response.data;
};

export const getCompetitionPlayerAssignments = async (
  competitionId: number,
  cckId: string,
): Promise<CompetitionPlayerAssignments> => {
  const normalizedCckId = normalizeCckId(cckId);
  return apiRequest<CompetitionPlayerAssignments>(
    `/competition/${competitionId}/player/${encodeURIComponent(normalizedCckId)}`,
  );
};

export const getCompetitionRoundAssignments = async (roundIdx: number): Promise<CompetitionRoundAssignments> => {
  return apiRequest<CompetitionRoundAssignments>(`/round/${roundIdx}`);
};

export const updateCompetitionPlayerAssignment = async (
  competitionId: number,
  payload: UpdatePlayerAssignmentRequest,
): Promise<void> => {
  const normalizedPayload: UpdatePlayerAssignmentRequest = {
    ...payload,
    cckId: normalizeCckId(payload.cckId),
  };
  const candidatePaths = [
    `/admin/competition/${competitionId}/player-assignment`,
    `/admin/competitions/${competitionId}/player-assignment`,
  ];

  let lastError: unknown = null;
  for (const path of candidatePaths) {
    try {
      await apiRequest(path, {
        method: 'POST',
        body: JSON.stringify(normalizedPayload),
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
  ];

  let lastError: unknown = null;
  for (const path of candidatePaths) {
    try {
      const response = await apiRequest<AutoAssignResponse>(path, {
        method: 'POST',
        body: JSON.stringify({
          confirmCompetitionName: payload.confirmCompetitionName,
          scramblerCandidateCckIds: payload.scramblerCandidateCckIds.map((item) => normalizeCckId(item)),
          scramblerCckIds: payload.scramblerCandidateCckIds.map((item) => normalizeCckId(item)),
          excludedCckIds: payload.excludedCckIds.map((item) => normalizeCckId(item)),
          scrambler: {
            candidateCckIds: payload.scramblerCandidateCckIds.map((item) => normalizeCckId(item)),
          },
          exclusion: {
            cckIds: payload.excludedCckIds.map((item) => normalizeCckId(item)),
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

export const exportCompetitionBadgeCsvZip = async (
  competitionId: number,
  payload: BadgeExportRequest,
): Promise<{ blob: Blob; fileName: string }> => {
  const base = (API_URL || '/api/v1').replace(/\/$/, '');
  const url = `${base}/admin/competition/${competitionId}/badge-export`;
  const token = getAccessToken();
  const headers = new Headers({
    Accept: 'application/zip',
    'Content-Type': 'application/json',
  });
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const encodedFileName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1] || '';
  const decodedFileName = encodedFileName ? decodeURIComponent(encodedFileName) : '';
  return {
    blob,
    fileName: decodedFileName || `competition-${competitionId}-badge-export.zip`,
  };
};
