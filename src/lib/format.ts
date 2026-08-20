import { formatDistanceToNowStrict } from "date-fns";

export function relativeTime(iso: string | null): string {
  if (!iso) return "unknown time";
  try {
    return `${formatDistanceToNowStrict(new Date(iso))} ago`;
  } catch {
    return "unknown time";
  }
}
