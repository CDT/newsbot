export type ScheduleOption = {
  cron: string;
  label: string;
};

export const ALLOWED_SCHEDULES: ScheduleOption[] = [
  { cron: '0 0 * * *', label: 'Daily at 08:00 UTC+8 (Wuhan)' },
  { cron: '0 4 * * *', label: 'Daily at 12:00 UTC+8 (Wuhan)' },
  { cron: '0 10 * * *', label: 'Daily at 18:00 UTC+8 (Wuhan)' },
];

const ALLOWED_SCHEDULE_SET = new Set(ALLOWED_SCHEDULES.map((option) => option.cron));

export function isAllowedScheduleCron(cron: string): boolean {
  return ALLOWED_SCHEDULE_SET.has(cron);
}
