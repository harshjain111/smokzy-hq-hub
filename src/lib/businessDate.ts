import { format } from "date-fns";

const DEFAULT_FORCE_CLOSE_HOUR = 7;

export function getBusinessDate(forceCloseHour = DEFAULT_FORCE_CLOSE_HOUR): string {
  const now = new Date();
  if (now.getHours() < forceCloseHour) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return format(yesterday, "yyyy-MM-dd");
  }
  return format(now, "yyyy-MM-dd");
}
