export type ScheduleOption = {
  cron: string;
  label: string;
};

export const ALLOWED_SCHEDULES: ScheduleOption[] = [
  { cron: '0 8 * * *', label: 'Daily at 08:00 UTC' },
  { cron: '0 12 * * *', label: 'Daily at 12:00 UTC' },
  { cron: '0 18 * * *', label: 'Daily at 18:00 UTC' },
];

const ALLOWED_SCHEDULE_SET = new Set(ALLOWED_SCHEDULES.map((option) => option.cron));

export function isAllowedScheduleCron(cron: string): boolean {
  return ALLOWED_SCHEDULE_SET.has(cron);
}
