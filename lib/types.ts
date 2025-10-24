/**
 * TypeScript types for the scheduler application
 * Ported from Python Pydantic models
 */

export type ComponentStatus = "OPEN" | "CLOSED" | "FULL" | "WAITLIST";
export type ComponentType = "LEC" | "LAB" | "TUT" | "DGD" | "SEM" | "WRK";
export type DayOfWeek = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
export type Language = "english" | "french";
export type Season = "winter" | "summer" | "fall";

export interface Component {
  course_id: number;
  section_id: string;
  id: string;
  guid: string;
  label: string;
  status: ComponentStatus;
  type: ComponentType;
  day: DayOfWeek;
  start_timestamp: number;
  start_time: string;
  start_time_12hr: string;
  end_timestamp: number;
  end_time: string;
  end_time_12hr: string;
  start_date: string;
  end_date: string;
  room: string;
  instructor: string;
  session_type: string;
  description: string;
}

export interface Section {
  course_id: number;
  id: string;
  label: string;
  instructor: string;
  description: string;
  num_components: number;
  components: Record<string, Component>;
}

export interface SectionsByLanguage {
  english: Record<string, Section>;
  french: Record<string, Section>;
}

export interface UnavailableComponent {
  course: string;
  component: string;
}

export interface ScheduleConfig {
  max_english: number;
  max_french: number;
  courses: string[];
  unavailable_components: UnavailableComponent[];
  no_weekends?: boolean;
  max_days?: number;
}

export interface SectionOption {
  section: Section;
  components: Component[];
  language: Language;
  course_code: string;
}

export interface Schedule {
  schedule_number: number;
  english_count: number;
  french_count: number;
  courses: ScheduleCourse[];
  score?: number;
}

export interface ScheduleCourse {
  course_code: string;
  language: Language;
  section_id: string;
  instructor: string;
  components: ComponentInfo[];
}

export interface ComponentInfo {
  label: string;
  type: ComponentType;
  day: DayOfWeek;
  start_time: string;
  end_time: string;
  status: ComponentStatus;
  room: string;
}

export interface ProfessorData {
  rmp_rating: number | null;
  rmp_difficulty: number | null;
  total_ratings: number | null;
  prof_overall_grade: number | null;
  avg_grade_in_courses: number | null;
}

export interface ProfessorScore {
  data: ProfessorData;
  score: number | null;
}

export type ProfessorCacheEntry = ProfessorData | ProfessorScore;

export interface TimeSlot {
  day: number;
  start_minutes: number;
  end_minutes: number;
}

// Cache interfaces
export interface SchedulerCacheEntry {
  timestamp: number;
  unavailable_components: UnavailableComponent[];
  data: Record<string, SectionsByLanguage>;
}

// Day mapping
export const DAY_MAP: Record<DayOfWeek, number> = {
  MO: 0,
  TU: 1,
  WE: 2,
  TH: 3,
  FR: 4,
  SA: 5,
  SU: 6,
};

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const DAY_NAMES_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
