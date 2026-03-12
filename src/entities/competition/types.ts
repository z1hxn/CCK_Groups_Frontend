export type Competition = {
  id: number;
  name: string;
  dateStart: string;
  dateEnd: string;
  location: string;
};

export type CompetitionStatus = 'now' | 'future' | 'past';

export type CompetitionDetail = Competition & {
  rounds: Round[];
};

export type ConfirmedRegistration = {
  id: number;
  competitionId: number;
  competitionName: string;
  name: string;
  enName: string;
  cckId: string;
  selectedEvents: string[];
  totalFee: number;
  paymentStatus: string;
  registrationStatus: string;
  needRfCard: boolean;
};

export type Round = {
  id: number;
  competitionId: number;
  competitionName: string;
  eventName: string;
  roundName: string;
  eventStart: string;
  eventEnd: string;
  advance: number | null;
};

export type RoundDayCount = {
  past: Round[];
  now: Round[];
  future: Round[];
};

export type PlayerRole = 'competition' | 'judge' | 'runner' | 'scrambler';

export type PlayerRoundInfo = {
  idx: number;
  compIdx: number;
  compName: string;
  cubeEventName: string;
  roundName: string;
  eventStart: string;
  eventEnd: string;
  roundGroupList: string[];
};

export type PlayerGroupAssignment = {
  idx: number;
  roundIdx: number;
  cckId: string;
  group: string;
  round: PlayerRoundInfo | null;
};

export type CompetitionPlayerAssignments = {
  compIdx: number;
  cckId: string;
  competition: PlayerGroupAssignment[];
  judge: PlayerGroupAssignment[];
  runner: PlayerGroupAssignment[];
  scrambler: PlayerGroupAssignment[];
};

export type RoundGroupAssignments = {
  group: string;
  competition: PlayerGroupAssignment[];
  judge: PlayerGroupAssignment[];
  runner: PlayerGroupAssignment[];
  scrambler: PlayerGroupAssignment[];
};

export type CompetitionRoundAssignments = {
  roundIdx: number;
  round: PlayerRoundInfo | null;
  competition: PlayerGroupAssignment[];
  judge: PlayerGroupAssignment[];
  runner: PlayerGroupAssignment[];
  scrambler: PlayerGroupAssignment[];
  groups: RoundGroupAssignments[];
};

export type RoundGroupConfig = {
  compIdx: number;
  roundIdx: number;
  groups: Array<{
    idx?: number;
    roundIdx?: number;
    groupName: string;
    playerCount: number;
    judgeCount: number;
    runnerCount: number;
    scramblerCount: number;
  }>;
  groupList?: string[];
  source?: 'db' | 'ranking';
};
