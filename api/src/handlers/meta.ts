import { ALLOWED_SCHEDULES } from '../constants/schedules';
import { jsonResponse } from '../utils/response';

export async function handleGetScheduleOptions(): Promise<Response> {
  return jsonResponse({ schedules: ALLOWED_SCHEDULES });
}
