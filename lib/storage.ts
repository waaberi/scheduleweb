/**
 * Client-side storage utilities using localStorage
 * Implements caching similar to the Python version
 */

import type {
  SchedulerCacheEntry,
  ProfessorCacheEntry,
  ProfessorData,
  ProfessorScore,
  ScheduleConfig,
  SectionsByLanguage,
} from "./types";

const SCHEDULER_CACHE_KEY = "scheduler_cache";
const PROFESSOR_CACHE_KEY = "professor_cache";
const CONFIG_CACHE_KEY = "scheduler_config";
const SCHEDULER_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes in milliseconds

// Check if we're in a browser environment
const isBrowser = typeof window !== "undefined";

/**
 * Load scheduler cache from localStorage
 */
export function loadSchedulerCache(): Record<string, SchedulerCacheEntry> {
  if (!isBrowser) return {};

  try {
    const cached = localStorage.getItem(SCHEDULER_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error("Error loading scheduler cache:", error);
  }
  return {};
}

/**
 * Save scheduler cache to localStorage
 */
export function saveSchedulerCache(cache: Record<string, SchedulerCacheEntry>) {
  if (!isBrowser) return;

  try {
    localStorage.setItem(SCHEDULER_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error("Error saving scheduler cache:", error);
  }
}

/**
 * Check if a cache entry is still valid (less than 5 minutes old and same unavailable components)
 */
export function isCacheValid(
  cacheEntry: SchedulerCacheEntry,
  unavailableComponents: any[]
): boolean {
  if (!cacheEntry.timestamp) {
    return false;
  }

  const currentTime = Date.now();
  const cacheTime = cacheEntry.timestamp;

  // Check time expiry
  if (currentTime - cacheTime >= SCHEDULER_CACHE_EXPIRY) {
    return false;
  }

  // Check if unavailable_components have changed
  const cachedUnavailable = cacheEntry.unavailable_components || [];
  if (JSON.stringify(cachedUnavailable) !== JSON.stringify(unavailableComponents)) {
    return false;
  }

  return true;
}

/**
 * Generate a cache key from course codes
 */
export function getCacheKey(courseCodes: string[]): string {
  return courseCodes.slice().sort().join(",");
}

/**
 * Cache course data
 */
export function cacheCourseData(
  courseCodes: string[],
  data: Record<string, SectionsByLanguage>,
  unavailableComponents: any[]
) {
  const cache = loadSchedulerCache();
  const key = getCacheKey(courseCodes);

  cache[key] = {
    timestamp: Date.now(),
    unavailable_components: unavailableComponents,
    data: data,
  };

  saveSchedulerCache(cache);
}

/**
 * Get cached course data
 */
export function getCachedCourseData(
  courseCodes: string[],
  unavailableComponents: any[]
): Record<string, SectionsByLanguage> | null {
  const cache = loadSchedulerCache();
  const key = getCacheKey(courseCodes);

  if (key in cache && isCacheValid(cache[key], unavailableComponents)) {
    return cache[key].data;
  }

  return null;
}

/**
 * Load professor cache from localStorage
 */
export function loadProfessorCache(): Record<string, ProfessorCacheEntry> {
  if (!isBrowser) return {};

  try {
    const cached = localStorage.getItem(PROFESSOR_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error("Error loading professor cache:", error);
  }
  return {};
}

/**
 * Save professor cache to localStorage
 */
export function saveProfessorCache(cache: Record<string, ProfessorCacheEntry>) {
  if (!isBrowser) return;

  try {
    localStorage.setItem(PROFESSOR_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error("Error saving professor cache:", error);
  }
}

/**
 * Cache professor data
 */
export function cacheProfessorData(instructor: string, data: ProfessorData) {
  const cache = loadProfessorCache();
  cache[instructor] = data;
  saveProfessorCache(cache);
}

/**
 * Get cached professor data
 * Returns cached data if available (no expiry by default - permanent cache)
 */
export function getCachedProfessorData(instructor: string): ProfessorData | null {
  const cache = loadProfessorCache();
  const entry = cache[instructor];

  if (!entry) {
    return null;
  }

  // Handle legacy cache entries that stored { data, score }
  if (
    typeof entry === "object" &&
    entry !== null &&
    "data" in (entry as ProfessorScore) &&
    (entry as ProfessorScore).data
  ) {
    const normalized = (entry as ProfessorScore).data;
    cache[instructor] = normalized;
    saveProfessorCache(cache);
    return normalized;
  }

  return entry as ProfessorData;
}

/**
 * Check if we should always use professor cache (dev mode setting)
 */
export function shouldAlwaysUseProfessorCache(): boolean {
  if (!isBrowser) return true;
  
  try {
    const setting = localStorage.getItem("dev_always_use_prof_cache");
    // Default to true if not set
    return setting === null ? true : setting === "true";
  } catch (error) {
    return true;
  }
}

/**
 * Set whether to always use professor cache (dev mode setting)
 */
export function setAlwaysUseProfessorCache(value: boolean) {
  if (!isBrowser) return;
  
  try {
    localStorage.setItem("dev_always_use_prof_cache", value.toString());
  } catch (error) {
    console.error("Error saving dev setting:", error);
  }
}

/**
 * Load user configuration from localStorage
 */
export function loadConfig(): ScheduleConfig | null {
  if (!isBrowser) return null;

  try {
    const cached = localStorage.getItem(CONFIG_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error("Error loading config:", error);
  }
  return null;
}

/**
 * Save user configuration to localStorage
 */
export function saveConfig(config: ScheduleConfig) {
  if (!isBrowser) return;

  try {
    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("Error saving config:", error);
  }
}

/**
 * Clear all caches
 */
export function clearAllCaches() {
  if (!isBrowser) return;

  try {
    localStorage.removeItem(SCHEDULER_CACHE_KEY);
    localStorage.removeItem(PROFESSOR_CACHE_KEY);
    console.log("All caches cleared");
  } catch (error) {
    console.error("Error clearing caches:", error);
  }
}

/**
 * Clear only professor cache
 */
export function clearProfessorCache() {
  if (!isBrowser) return;

  try {
    localStorage.removeItem(PROFESSOR_CACHE_KEY);
    console.log("Professor cache cleared");
  } catch (error) {
    console.error("Error clearing professor cache:", error);
  }
}

/**
 * Reset all dev settings to defaults
 */
export function resetDevSettings() {
  if (!isBrowser) return;
  
  try {
    localStorage.removeItem("dev_always_use_prof_cache");
    console.log("Dev settings reset to defaults");
  } catch (error) {
    console.error("Error resetting dev settings:", error);
  }
}
