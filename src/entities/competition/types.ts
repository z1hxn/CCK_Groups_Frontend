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
