import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Check if a course code is for a French course (5th character >= 5)
 */
export function isFrench(courseCode: string): boolean {
  return parseInt(courseCode[1]) >= 5;
}

/**
 * Get the language equivalent of a course code (English <-> French)
 */
export function languageEquivalent(courseCode: string): string {
  const direction = (isFrench(courseCode) ? -1 : 1);
  const tmp = parseInt(courseCode[1]) + 4 * direction;
  const chars = courseCode.split("");
  chars[1] = tmp.toString();
  return chars.join("");
}

/**
 * Parse a course code like 'ITI1100' into subject and code
 */
export function parseCourseCode(courseCode: string): {
  subject: string;
  code: string;
} {
  const subject = courseCode.slice(0, 3);
  const code = courseCode.slice(3);
  return { subject, code };
}

/**
 * Get the default season based on the current month
 */
export function getDefaultSeason(): "winter" | "summer" | "fall" {
  const month = new Date().getMonth() + 1;

  if (month <= 4) {
    return "summer";
  } else if (month <= 8) {
    return "fall";
  } else {
    return "winter";
  }
}

/**
 * Get the current year unless we're looking for winter (next year)
 */
export function getDefaultYear(): number {
  const year = new Date().getFullYear();
  return getDefaultSeason() === "winter" ? year + 1 : year;
}

/**
 * Format a time string from minutes since midnight
 */
export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
