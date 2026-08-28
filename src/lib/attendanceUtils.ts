import { parseISO } from 'date-fns';

export const DEFAULT_WORK_START_TIME = '08:00';

export function getOfficialStartTime(): string {
  try {
    return localStorage.getItem('attendance_start_time') || DEFAULT_WORK_START_TIME;
  } catch {
    return DEFAULT_WORK_START_TIME;
  }
}

export function setOfficialStartTime(time: string): void {
  try {
    localStorage.setItem('attendance_start_time', time);
  } catch (e) {
    console.error('Error saving start time:', e);
  }
}

export interface DelayInfo {
  isLate: boolean;
  delayMinutes: number;
  label: string;
}

export function calculateDelayMinutes(timestampISO: string, officialStartTimeStr: string = DEFAULT_WORK_START_TIME): number {
  try {
    const dt = parseISO(timestampISO);
    const logHour = dt.getHours();
    const logMinute = dt.getMinutes();
    const logTotalMinutes = logHour * 60 + logMinute;

    const [targetH, targetM] = officialStartTimeStr.split(':').map(Number);
    const targetTotalMinutes = (isNaN(targetH) ? 8 : targetH) * 60 + (isNaN(targetM) ? 0 : targetM);

    return logTotalMinutes - targetTotalMinutes;
  } catch {
    return 0;
  }
}

export function getDelayInfo(timestampISO: string, officialStartTimeStr: string = DEFAULT_WORK_START_TIME): DelayInfo {
  const delay = calculateDelayMinutes(timestampISO, officialStartTimeStr);
  if (delay > 0) {
    return {
      isLate: true,
      delayMinutes: delay,
      label: `+${delay} min atraso`
    };
  }
  return {
    isLate: false,
    delayMinutes: 0,
    label: 'A tiempo'
  };
}

export function calculateDayWorkedMinutes(dayLogs: { type: string; timestamp: string }[]): number {
  if (!dayLogs || dayLogs.length === 0) return 0;
  const sortedLogs = [...dayLogs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  let dayMinutes = 0;
  let lastArrival: Date | null = null;
  let hasLogsPast1PM = false;

  sortedLogs.forEach(log => {
    const logDate = parseISO(log.timestamp);
    if (logDate.getHours() >= 13) {
      hasLogsPast1PM = true;
    }

    if (log.type === 'arrival' || log.type === 'break_end') {
      lastArrival = logDate;
    } else if ((log.type === 'departure' || log.type === 'break_start') && lastArrival) {
      const diff = Math.floor((logDate.getTime() - lastArrival.getTime()) / 60000);
      dayMinutes += Math.max(0, diff);
      lastArrival = null;
    }
  });

  // Descontar una hora (60 minutos) de colación si hay actividades registradas en la tarde (después de las 13:00)
  if (hasLogsPast1PM && dayMinutes > 60) {
    dayMinutes = Math.max(0, dayMinutes - 60);
  }

  return dayMinutes;
}
