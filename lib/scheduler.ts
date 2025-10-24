/**
 * Course scheduling algorithm
 * Ported from Python scheduler.py
 */

import type {
  Component,
  Section,
  SectionsByLanguage,
  SectionOption,
  TimeSlot,
  UnavailableComponent,
  DAY_MAP as DayMapType,
} from "./types";
import { DAY_MAP } from "./types";
import { isFrench, languageEquivalent, parseCourseCode } from "./utils";

/**
 * Apply unavailable patches to mark components as closed
 */
export function applyUnavailablePatches(
  coursesData: Record<string, SectionsByLanguage>,
  unavailableComponents: UnavailableComponent[]
): number {
  let patchedCount = 0;

  for (const patch of unavailableComponents) {
    const courseCode = patch.course;
    const componentLabel = patch.component; // e.g., "A00-LEC", "B01-LAB"

    // Extract section ID from component (e.g., "B01-LAB" -> section "B")
    const sectionId = componentLabel.split("-")[0][0];

    // Check if course_code exists directly, or if it's a language equivalent
    let targetCourse: string | null = null;
    if (courseCode in coursesData) {
      targetCourse = courseCode;
    } else {
      // Try to find the language equivalent
      const { subject, code } = parseCourseCode(courseCode);
      const equivalentCode = languageEquivalent(code);
      const equivalentCourseCode = subject + equivalentCode;
      if (equivalentCourseCode in coursesData) {
        targetCourse = equivalentCourseCode;
      }
    }

    if (targetCourse === null) {
      console.warn(
        `Course ${courseCode} not found (tried ${courseCode} and its language equivalent)`
      );
      continue;
    }

    // Check both English and French sections
    for (const lang of ["english", "french"] as const) {
      const sections = coursesData[targetCourse][lang];
      if (sectionId in sections) {
        const section = sections[sectionId];
        // Search through all components to find matching label
        for (const [compGuid, component] of Object.entries(section.components)) {
          if (component.label === componentLabel) {
            // Mark component as CLOSED
            component.status = "CLOSED";
            patchedCount++;
            console.log(
              `Patched ${courseCode} Section ${sectionId} - ${componentLabel}: marked as CLOSED`
            );
          }
        }
      }
    }
  }

  return patchedCount;
}

/**
 * Convert a Component to a time tuple (day, start_minutes, end_minutes)
 */
function componentToTimeSlot(component: Component): TimeSlot {
  const dayIdx = DAY_MAP[component.day];
  const startMinutes = component.start_timestamp / 60;
  const endMinutes = component.end_timestamp / 60;
  return {
    day: dayIdx,
    start_minutes: startMinutes,
    end_minutes: endMinutes,
  };
}

/**
 * Check if two time slots conflict
 */
function timesConflict(t1: TimeSlot, t2: TimeSlot): boolean {
  return t1.day === t2.day && !(t1.end_minutes <= t2.start_minutes || t2.end_minutes <= t1.start_minutes);
}

/**
 * Generate all possible component combinations for a section
 */
export function generateSectionOptions(section: Section): SectionOption[] {
  // Group ALL components by type to check original requirements
  const allComponentsByType: Record<string, Component[]> = {};
  for (const comp of Object.values(section.components)) {
    if (!allComponentsByType[comp.type]) {
      allComponentsByType[comp.type] = [];
    }
    allComponentsByType[comp.type].push(comp);
  }

  // Group OPEN components by type
  const openComponentsByType: Record<string, Component[]> = {};
  for (const comp of Object.values(section.components)) {
    if (comp.status === "OPEN") {
      if (!openComponentsByType[comp.type]) {
        openComponentsByType[comp.type] = [];
      }
      openComponentsByType[comp.type].push(comp);
    }
  }

  // Validation Step 1: Check Lectures
  const allLectures = allComponentsByType["LEC"] || [];
  const openLectures = openComponentsByType["LEC"] || [];
  if (allLectures.length > 0 && allLectures.length !== openLectures.length) {
    return []; // Discard section if any lecture is not open
  }

  // Validation Step 2: Check Other Required Components
  for (const compType of ["LAB", "TUT", "DGD", "SEM", "WRK"]) {
    const allComps = allComponentsByType[compType] || [];
    const openComps = openComponentsByType[compType] || [];
    if (allComps.length > 0 && openComps.length === 0) {
      return []; // Discard section
    }
  }

  // Combination Generation Step
  const requiredLectures = openLectures;

  // For other components, create choices
  const labChoices = (allComponentsByType["LAB"] || []).length > 0
    ? (openComponentsByType["LAB"] || []).map((c) => [c])
    : [[]];

  const tutChoices = (allComponentsByType["TUT"] || []).length > 0
    ? (openComponentsByType["TUT"] || []).map((c) => [c])
    : [[]];

  const dgdChoices = (allComponentsByType["DGD"] || []).length > 0
    ? (openComponentsByType["DGD"] || []).map((c) => [c])
    : [[]];

  const semChoices = (allComponentsByType["SEM"] || []).length > 0
    ? (openComponentsByType["SEM"] || []).map((c) => [c])
    : [[]];

  const wrkChoices = (allComponentsByType["WRK"] || []).length > 0
    ? (openComponentsByType["WRK"] || []).map((c) => [c])
    : [[]];

  // Generate all combinations using cartesian product
  const options: SectionOption[] = [];

  for (const lab of labChoices) {
    for (const tut of tutChoices) {
      for (const dgd of dgdChoices) {
        for (const sem of semChoices) {
          for (const wrk of wrkChoices) {
            const allComponents = [...requiredLectures, ...lab, ...tut, ...dgd, ...sem, ...wrk];

            options.push({
              section: section,
              components: allComponents,
              language: "english", // Will be set later
              course_code: "", // Will be set later
            });
          }
        }
      }
    }
  }

  return options;
}

/**
 * Check if any component in the schedule is on Saturday or Sunday
 */
function hasWeekendClasses(scheduleCombo: SectionOption[]): boolean {
  for (const option of scheduleCombo) {
    for (const component of option.components) {
      if (component.day === "SA" || component.day === "SU") {
        return true;
      }
    }
  }
  return false;
}

/**
 * Count the number of unique days that have classes in the schedule
 */
function countUniqueDays(scheduleCombo: SectionOption[]): number {
  const daysWithClasses = new Set<string>();
  for (const option of scheduleCombo) {
    for (const component of option.components) {
      if (component.day) {
        daysWithClasses.add(component.day);
      }
    }
  }
  return daysWithClasses.size;
}

/**
 * Cartesian product helper function
 */
function* cartesianProduct<T>(arrays: T[][]): Generator<T[]> {
  if (arrays.length === 0) {
    yield [];
    return;
  }

  const [first, ...rest] = arrays;
  for (const item of first) {
    for (const combo of cartesianProduct(rest)) {
      yield [item, ...combo];
    }
  }
}

/**
 * Generate all valid schedules considering language constraints
 */
export function generateAllSchedules(
  coursesData: Record<string, SectionsByLanguage>,
  maxEnglish: number,
  maxFrench: number,
  noWeekends: boolean = false,
  maxDays?: number
): SectionOption[][] {
  // Build all possible section choices for each course
  const allCourseOptions: SectionOption[][] = [];
  const courseCodes: string[] = [];

  for (const [courseCode, langSections] of Object.entries(coursesData)) {
    courseCodes.push(courseCode);
    const sectionChoices: SectionOption[] = [];

    // For each English section, generate all possible component combinations
    for (const section of Object.values(langSections.english)) {
      const sectionOpts = generateSectionOptions(section);
      for (const opt of sectionOpts) {
        opt.language = "english";
        opt.course_code = courseCode;
        sectionChoices.push(opt);
      }
    }

    // For each French section, generate all possible component combinations
    for (const section of Object.values(langSections.french)) {
      const sectionOpts = generateSectionOptions(section);
      for (const opt of sectionOpts) {
        opt.language = "french";
        opt.course_code = courseCode;
        sectionChoices.push(opt);
      }
    }

    allCourseOptions.push(sectionChoices);
  }

  // Calculate and print valid combinations
  let totalValidCombos = 1;
  for (const options of allCourseOptions) {
    totalValidCombos *= options.length;
  }

  console.log("Valid section/component combinations per course:");
  for (let i = 0; i < courseCodes.length; i++) {
    console.log(`  ${courseCodes[i]}: ${allCourseOptions[i].length} valid options`);
  }
  console.log(`\nTotal valid combinations to check: ${totalValidCombos}\n`);

  // Generate all combinations
  const validSchedules: SectionOption[][] = [];
  let totalChecked = 0;

  for (const combo of cartesianProduct(allCourseOptions)) {
    totalChecked++;

    // Check language constraints early
    const englishCount = combo.filter((opt) => opt.language === "english").length;
    const frenchCount = combo.filter((opt) => opt.language === "french").length;

    if (maxEnglish !== -1 && englishCount > maxEnglish) {
      continue;
    }

    if (maxFrench !== -1 && frenchCount > maxFrench) {
      continue;
    }

    // Check weekend constraint
    if (noWeekends && hasWeekendClasses(combo)) {
      continue;
    }

    // Check max days constraint
    if (maxDays !== undefined && countUniqueDays(combo) > maxDays) {
      continue;
    }

    // Check for time conflicts
    const allTimes: TimeSlot[] = [];
    for (const option of combo) {
      for (const component of option.components) {
        allTimes.push(componentToTimeSlot(component));
      }
    }

    // Check all pairs for conflicts
    let conflict = false;
    for (let i = 0; i < allTimes.length; i++) {
      for (let j = i + 1; j < allTimes.length; j++) {
        if (timesConflict(allTimes[i], allTimes[j])) {
          conflict = true;
          break;
        }
      }
      if (conflict) break;
    }

    if (!conflict) {
      validSchedules.push(combo);
    }
  }

  console.log(`Checked ${totalChecked} combinations, found ${validSchedules.length} valid schedules.`);
  return validSchedules;
}

/**
 * Calculate professor score based on data
 * Formula: 80% weight on rating component, 20% weight on grade component
 * Rating component: rmp_rating - rmp_difficulty
 * Grade component: prof_overall_grade - avg_grade_in_courses
 */
export function calculateProfScore(profData: any): number | null {
  if (!profData) return null;

  const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

  let weightedTotal = 0;
  let weightSum = 0;

  if (isFiniteNumber(profData.rmp_rating) && isFiniteNumber(profData.rmp_difficulty)) {
    weightedTotal += (profData.rmp_rating - profData.rmp_difficulty) * 0.8;
    weightSum += 0.8;
  }

  if (
    isFiniteNumber(profData.prof_overall_grade) &&
    isFiniteNumber(profData.avg_grade_in_courses)
  ) {
    weightedTotal += (profData.prof_overall_grade - profData.avg_grade_in_courses) * 0.2;
    weightSum += 0.2;
  }

  if (weightSum === 0) {
    return null;
  }

  const normalizedScore = weightedTotal / weightSum;
  return Math.round(normalizedScore * 10000) / 10000;
}

/**
 * Calculate the total score for a schedule based on professor scores
 * If some professors are missing data, use the average of available scores
 */
export function calculateScheduleScore(
  schedule: SectionOption[],
  profDataMap: Record<string, any>
): number | null {
  const scores: number[] = [];
  let missingCount = 0;

  for (const option of schedule) {
    const instructor = option.section.instructor;

    if (instructor in profDataMap) {
      const score = calculateProfScore(profDataMap[instructor]);
      if (score !== null) {
        scores.push(score);
      } else {
        missingCount++;
      }
    } else {
      missingCount++;
    }
  }

  // If no valid scores at all, return null
  if (scores.length === 0) {
    return null;
  }

  // Calculate average of available scores
  const totalScore = scores.reduce((sum, s) => sum + s, 0);
  const avgScore = totalScore / scores.length;
  
  // Scale by the proportion of courses that have scores
  // This way schedules with more complete data are scored higher
  const completenessRatio = scores.length / schedule.length;
  const finalScore = avgScore * completenessRatio;

  return Math.round(finalScore * 10000) / 10000;
}
