export type ScheduleOption = {
  cron: string;
  label: string;
};

export const ALLOWED_SCHEDULES: ScheduleOption[] = [
  { cron: '0 0 * * *', label: 'Daily at 08:00 UTC+8 (Wuhan)' },
  { cron: '0 1 * * *', label: 'Daily at 09:00 UTC+8 (Wuhan)' },
  { cron: '0 2 * * *', label: 'Daily at 10:00 UTC+8 (Wuhan)' },
  { cron: '0 7 * * *', label: 'Daily at 15:00 UTC+8 (Wuhan)' },
  { cron: '0 8 * * *', label: 'Daily at 16:00 UTC+8 (Wuhan)' },
];

const ALLOWED_SCHEDULE_SET = new Set(ALLOWED_SCHEDULES.map((option) => option.cron));

export function isAllowedScheduleCron(cron: string): boolean {
  return cron.split(',').every((part) => ALLOWED_SCHEDULE_SET.has(part.trim()));
}
