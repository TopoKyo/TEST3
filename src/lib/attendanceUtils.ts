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
