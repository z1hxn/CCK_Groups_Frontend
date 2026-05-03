import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  exportCompetitionBadgeCsvZip,
  getCompetitionDetail,
} from '@/entities/competition/api';
import type { CompetitionDetail } from '@/entities/competition/types';
import { isAdminByToken } from '@/shared/auth/tokenStorage';
import { OverlayToast } from '@/widgets/overlay';
import { PageHeader } from '@/widgets/pageHeader/PageHeader';

type EventPathConfig = {
  eventCode: string;
  eventName: string;
  displayLabel: string;
  enablePath: string;
  disablePath: string;
};

type RoundColumnConfig = {
  roundIdx: number;
  eventCode: string;
  eventName: string;
  roundName: string;
  displayLabel: string;
};

const normalizeEventName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '');

const eventCodeAliases = new Map<string, string>([
  ['2x2x2', '22'],
  ['22', '22'],
  ['222', '22'],
  ['3x3x3', '33'],
  ['33', '33'],
  ['333', '33'],
  ['4x4x4', '44'],
  ['44', '44'],
  ['444', '44'],
  ['5x5x5', '55'],
  ['55', '55'],
  ['555', '55'],
  ['6x6x6', '66'],
  ['66', '66'],
  ['666', '66'],
  ['7x7x7', '77'],
  ['77', '77'],
  ['777', '77'],
]);

const toEventCode = (value: string) => {
  const normalized = normalizeEventName(value)
    .replace(/큐브|cube|rubik|rubikscube|puzzle|event/gi, '')
    .replace(/[()\-_/]/g, '')
    .trim();
  if (!normalized) return '';
  const alias = eventCodeAliases.get(normalized);
  if (alias) return alias;
  const repeatedCubeMatch = normalized.match(/^([2-7])x\1x\1$/);
  if (repeatedCubeMatch) return `${repeatedCubeMatch[1]}${repeatedCubeMatch[1]}`;
  const tripledDigitMatch = normalized.match(/^([2-7])\1\1$/);
  if (tripledDigitMatch) return `${tripledDigitMatch[1]}${tripledDigitMatch[1]}`;
  const doubledDigitMatch = normalized.match(/^([2-7])\1$/);
  if (doubledDigitMatch) return `${doubledDigitMatch[1]}${doubledDigitMatch[1]}`;
  return normalized.replace(/[^a-z0-9]/g, '');
};

const toRoundColumnSuffix = (roundName: string) => {
  const raw = String(roundName || '').trim();
  if (!raw) return '';
  if (/결승|final/i.test(raw)) return 'final';
  const digitMatch = raw.match(/(\d+)/);
  if (digitMatch) return `${digitMatch[1]}r`;
  return raw.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9가-힣]/g, '');
};

export const AdminCompetitionBadgeExportPage = () => {
  const { compIdx } = useParams();
  const competitionId = Number(compIdx);
  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [basePath, setBasePath] = useState('');
  const [eventConfigs, setEventConfigs] = useState<EventPathConfig[]>([]);
  const [roundColumns, setRoundColumns] = useState<RoundColumnConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; variant: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    variant: 'info',
  });

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
      } catch {
        if (mounted) {
          setToast({ open: true, variant: 'error', message: '대회 정보를 불러오지 못했습니다.' });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, [competitionId]);

  const detectedEvents = useMemo(() => {
    const rounds = competition?.rounds
      ? [...competition.rounds].sort((a, b) => new Date(a.eventStart).getTime() - new Date(b.eventStart).getTime())
      : [];
    const eventMap = new Map<string, string>();
    for (const round of rounds) {
      const eventCode = toEventCode(round.eventName);
      if (!eventCode || eventMap.has(eventCode)) continue;
      eventMap.set(eventCode, round.eventName);
    }
    return [...eventMap.entries()].map(([eventCode, eventName]) => ({ eventCode, eventName }));
  }, [competition?.rounds]);

  const detectedRounds = useMemo(() => {
    const rounds = competition?.rounds
      ? [...competition.rounds].sort((a, b) => new Date(a.eventStart).getTime() - new Date(b.eventStart).getTime())
      : [];
    return rounds
      .map((round) => {
        const eventCode = toEventCode(round.eventName);
        if (!eventCode) return null;
        return {
          roundIdx: round.id,
          eventCode,
          eventName: round.eventName,
          roundName: round.roundName,
        };
      })
      .filter((item): item is { roundIdx: number; eventCode: string; eventName: string; roundName: string } => item !== null);
  }, [competition?.rounds]);

  useEffect(() => {
    setEventConfigs((prev) => {
      const prevMap = new Map(prev.map((item) => [item.eventCode, item]));
      return detectedEvents.map((event) => {
        const existing = prevMap.get(event.eventCode);
        return {
          eventCode: event.eventCode,
          eventName: event.eventName,
          displayLabel: existing?.displayLabel || event.eventCode,
          enablePath: existing?.enablePath || '',
          disablePath: existing?.disablePath || '',
        };
      });
    });
  }, [detectedEvents]);

  useEffect(() => {
    setRoundColumns((prev) => {
      const prevMap = new Map(prev.map((item) => [item.roundIdx, item]));
      const eventDisplayLabelByCode = new Map(eventConfigs.map((item) => [item.eventCode, item.displayLabel.trim() || item.eventCode]));
      return detectedRounds.map((round) => {
        const existing = prevMap.get(round.roundIdx);
        if (existing) {
          return {
            ...existing,
            eventCode: round.eventCode,
            eventName: round.eventName,
            roundName: round.roundName,
          };
        }
        const eventLabel = eventDisplayLabelByCode.get(round.eventCode) || round.eventCode;
        const suffix = toRoundColumnSuffix(round.roundName);
        return {
          ...round,
          displayLabel: suffix ? `${eventLabel}-${suffix}` : eventLabel,
        };
      });
    });
  }, [detectedRounds, eventConfigs]);

  const downloadZip = async () => {
    if (!competition) return;
    if (!basePath.trim()) {
      setToast({ open: true, variant: 'error', message: '기본 경로를 입력해 주세요.' });
      return;
    }
    if (eventConfigs.length === 0) {
      setToast({ open: true, variant: 'error', message: '추출할 종목이 없습니다.' });
      return;
    }

    const invalidItem = eventConfigs.find((item) => !item.enablePath.trim() || !item.disablePath.trim());
    if (invalidItem) {
      setToast({
        open: true,
        variant: 'error',
        message: `${invalidItem.eventCode} 종목의 Enable/Disable 경로를 모두 입력해 주세요.`,
      });
      return;
    }
    const invalidLabelItem = eventConfigs.find((item) => !item.displayLabel.trim());
    if (invalidLabelItem) {
      setToast({
        open: true,
        variant: 'error',
        message: `${invalidLabelItem.eventName} 종목의 표시명을 입력해 주세요.`,
      });
      return;
    }
    const invalidRoundLabel = roundColumns.find((item) => !item.displayLabel.trim());
    if (invalidRoundLabel) {
      setToast({
        open: true,
        variant: 'error',
        message: `${invalidRoundLabel.eventName} ${invalidRoundLabel.roundName} 라운드의 컬럼명을 입력해 주세요.`,
      });
      return;
    }

    setExporting(true);
    try {
      const { blob, fileName } = await exportCompetitionBadgeCsvZip(competitionId, {
        basePath: basePath.trim(),
        eventImages: eventConfigs.map((item) => ({
          eventCode: item.eventCode,
          displayLabel: item.displayLabel.trim(),
          enablePath: item.enablePath.trim(),
          disablePath: item.disablePath.trim(),
        })),
        roundColumns: roundColumns.map((item) => ({
          roundIdx: item.roundIdx,
          displayLabel: item.displayLabel.trim(),
        })),
      });

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setToast({ open: true, variant: 'success', message: 'ZIP 파일 생성이 완료되었습니다.' });
    } catch (error) {
      setToast({ open: true, variant: 'error', message: `추출 실패: ${String(error)}` });
    } finally {
      setExporting(false);
    }
  };

  if (!isAdminByToken()) return <div className="empty-state">403 Forbidden</div>;
  if (!Number.isFinite(competitionId)) return <div className="empty-state">잘못된 접근입니다.</div>;
  if (loading) return <div className="empty-state">조편성 추출 데이터 로딩 중...</div>;
  if (!competition) return <div className="empty-state">대회 정보를 불러올 수 없습니다.</div>;

  return (
    <div className="comp-page">
      <PageHeader
        containerClassName="comp-header"
        title="조편성 추출"
        subtitle={
          <>
            <span>{competition.name}</span>
            <span className="page-title-meta-divider">·</span>
            <span>명찰 앞면/뒷면 CSV ZIP 생성</span>
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
          <h3>이미지 경로 설정</h3>
          <div className="admin-round-detail-row">
            <span>기본 경로</span>
            <input
              className="admin-reset-confirm-input"
              value={basePath}
              onChange={(event) => setBasePath(event.target.value)}
              placeholder="/Users/.../Icon/png"
            />
          </div>

          <div className="admin-player-table-wrap">
            <table className="admin-player-table">
              <thead>
                <tr>
                  <th>종목</th>
                  <th>표시명</th>
                  <th>Enable 경로</th>
                  <th>Disable 경로</th>
                </tr>
              </thead>
              <tbody>
                {eventConfigs.map((item) => (
                  <tr key={`badge-event-${item.eventCode}`}>
                    <td>
                      {item.eventName || item.eventCode}
                    </td>
                    <td>
                      <input
                        className="admin-reset-confirm-input"
                        value={item.displayLabel}
                        onChange={(event) =>
                          setEventConfigs((prev) =>
                            prev.map((configItem) =>
                              configItem.eventCode === item.eventCode
                                ? { ...configItem, displayLabel: event.target.value }
                                : configItem,
                            ),
                          )
                        }
                        placeholder="33, 3x3x3oh 등"
                      />
                    </td>
                    <td>
                      <input
                        className="admin-reset-confirm-input"
                        value={item.enablePath}
                        onChange={(event) =>
                          setEventConfigs((prev) =>
                            prev.map((configItem) =>
                              configItem.eventCode === item.eventCode
                                ? { ...configItem, enablePath: event.target.value }
                                : configItem,
                            ),
                          )
                        }
                        placeholder="/enable/3x3x3"
                      />
                    </td>
                    <td>
                      <input
                        className="admin-reset-confirm-input"
                        value={item.disablePath}
                        onChange={(event) =>
                          setEventConfigs((prev) =>
                            prev.map((configItem) =>
                              configItem.eventCode === item.eventCode
                                ? { ...configItem, disablePath: event.target.value }
                                : configItem,
                            ),
                          )
                        }
                        placeholder="/disable/3x3x3"
                      />
                    </td>
                  </tr>
                ))}
                {eventConfigs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="admin-player-table-empty">
                      감지된 종목이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <h3>명찰 뒷면 라운드 컬럼명</h3>
          <div className="admin-player-table-wrap">
            <table className="admin-player-table">
              <thead>
                <tr>
                  <th>종목</th>
                  <th>라운드</th>
                  <th>컬럼명</th>
                </tr>
              </thead>
              <tbody>
                {roundColumns.map((item) => (
                  <tr key={`badge-round-${item.roundIdx}`}>
                    <td>{item.eventName || item.eventCode}</td>
                    <td>{item.roundName || `Round ${item.roundIdx}`}</td>
                    <td>
                      <input
                        className="admin-reset-confirm-input"
                        value={item.displayLabel}
                        onChange={(event) =>
                          setRoundColumns((prev) =>
                            prev.map((configItem) =>
                              configItem.roundIdx === item.roundIdx
                                ? { ...configItem, displayLabel: event.target.value }
                                : configItem,
                            ),
                          )
                        }
                        placeholder="예: 333-1r, 333-final"
                      />
                    </td>
                  </tr>
                ))}
                {roundColumns.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="admin-player-table-empty">
                      감지된 라운드가 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="admin-info-box">
            <strong>출력 파일</strong>
            <span>앞면/뒷면 각각 전체·일반참가자·조직위원으로 분리된 CSV가 ZIP으로 생성됩니다.</span>
            <span>CSV는 UTF-8 인코딩으로 생성됩니다.</span>
          </div>

          <div className="admin-round-detail-actions">
            <button type="button" className="admin-save-all-btn" disabled={exporting} onClick={() => void downloadZip()}>
              {exporting ? '생성 중...' : '조편성 추출 ZIP 다운로드'}
            </button>
          </div>
        </section>
      </div>

      <OverlayToast
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
};
