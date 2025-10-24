"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ConfigForm } from "@/components/config-form";
import { ScheduleListView } from "@/components/schedule-list-view";
import { ScheduleCalendarView } from "@/components/schedule-calendar-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScheduleConfig, SectionsByLanguage, SectionOption } from "@/lib/types";
import {
  loadConfig,
  saveConfig,
  getCachedCourseData,
  cacheCourseData,
  getCachedProfessorData,
  cacheProfessorData,
  clearAllCaches,
  clearProfessorCache,
  shouldAlwaysUseProfessorCache,
  setAlwaysUseProfessorCache,
  resetDevSettings,
} from "@/lib/storage";
import {
  generateAllSchedules,
  applyUnavailablePatches,
  calculateScheduleScore,
  calculateProfScore,
} from "@/lib/scheduler";
import { getDefaultSeason, getDefaultYear } from "@/lib/utils";
import { Calendar, List, Trash2, Settings } from "lucide-react";

export default function Home() {
  const [config, setConfig] = useState<ScheduleConfig | undefined>(undefined);
  const [schedules, setSchedules] = useState<Array<{ schedule: SectionOption[]; score: number | null }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [rankByProfessor, setRankByProfessor] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [showDevMode, setShowDevMode] = useState(false);
  const [alwaysUseProfCache, setAlwaysUseProfCache] = useState(true);

  const totalPages = Math.ceil(schedules.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const displayedSchedules = schedules.slice(startIndex, endIndex);

  // Reset to page 1 when schedules change
  useEffect(() => {
    setCurrentPage(1);
  }, [schedules]);

  // Load config and settings only on the client after mount
  useEffect(() => {
    const loadedConfig = loadConfig();
    setConfig(loadedConfig || undefined);
    setAlwaysUseProfCache(shouldAlwaysUseProfessorCache());
  }, []);

  const fetchCourseData = async (
    courseCode: string
  ): Promise<SectionsByLanguage> => {
    const season = getDefaultSeason();
    const year = getDefaultYear();

    const response = await fetch(
      `/api/courses?courseCode=${courseCode}&season=${season}&year=${year}&bilingual=true`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch course ${courseCode}`);
    }

    return await response.json();
  };

  const fetchProfessorData = async (instructor: string) => {
    const cached = getCachedProfessorData(instructor);
    if (cached && alwaysUseProfCache) {
      console.log(`Using cached professor data for ${instructor}`);
      return cached;
    }

    console.log(`Fetching professor data for ${instructor}...`);
    
    const response = await fetch(
      `/api/professors?instructor=${encodeURIComponent(instructor)}`
    );

    if (!response.ok) {
      console.warn(`Failed to fetch professor data for ${instructor}`);
      return null;
    }

    const data = await response.json();
    // Cache only the professor data (not wrapped in any response object)
    cacheProfessorData(instructor, data);
    return data;
  };

  const handleGenerateSchedules = async (config: ScheduleConfig) => {
    setIsLoading(true);
    setError(null);
    setConfig(config);
    saveConfig(config);
    
    const loadingToastId = toast.loading("Generating schedules...");

    try {
      console.log("Fetching course sections...");
      console.log(`Courses: ${config.courses.join(", ")}`);

      // Try to load from cache
      let coursesData = getCachedCourseData(
        config.courses,
        config.unavailable_components
      );

      if (!coursesData) {
        console.log("Cache miss, fetching fresh data...");
        coursesData = {};

        for (const courseCode of config.courses) {
          console.log(`Fetching ${courseCode}...`);
          coursesData[courseCode] = await fetchCourseData(courseCode);
        }

        // Apply unavailable component patches
        if (config.unavailable_components.length > 0) {
          console.log("Applying unavailable component patches...");
          const patchedCount = applyUnavailablePatches(
            coursesData,
            config.unavailable_components
          );
          console.log(`Patched ${patchedCount} components`);
        }

        // Cache the data
        cacheCourseData(config.courses, coursesData, config.unavailable_components);
      } else {
        console.log("Using cached course data");
      }

      console.log("Generating schedules...");
      
      let validSchedules = generateAllSchedules(
        coursesData,
        config.max_english,
        config.max_french,
        config.no_weekends,
        config.max_days
      );

      console.log(`Found ${validSchedules.length} valid schedules`);

      // Always fetch professor data and calculate scores
      console.log("Fetching professor data...");
      
      const allInstructors = new Set<string>();

      for (const langSections of Object.values(coursesData)) {
        for (const section of Object.values(langSections.english)) {
          allInstructors.add(section.instructor);
        }
        for (const section of Object.values(langSections.french)) {
          allInstructors.add(section.instructor);
        }
      }

      const profDataMap: Record<string, any> = {};
      
      for (const instructor of allInstructors) {
        const data = await fetchProfessorData(instructor);
        if (data) {
          profDataMap[instructor] = data;
        }
      }

      const fetchedProfessors = Object.keys(profDataMap).length;
      console.log(`Fetched data for ${fetchedProfessors} professors`);
      const sampleProfessor = Object.entries(profDataMap)[0];
      if (sampleProfessor) {
        console.log("Sample professor entry:", sampleProfessor[0], sampleProfessor[1]);
      }
      if (fetchedProfessors === 0) {
        console.warn("No professor data fetched; scores will be unavailable.");
      }
      
      // Calculate scores for all schedules
      const schedulesWithScores: Array<{
        schedule: SectionOption[];
        score: number | null;
      }> = [];

      for (const schedule of validSchedules) {
        const score = calculateScheduleScore(schedule, profDataMap);
        schedulesWithScores.push({ schedule, score });
      }

      console.log(`Calculated scores for ${schedulesWithScores.length} schedules`);
      console.log(`Sample scores:`, schedulesWithScores.slice(0, 3).map(s => s.score));
      const schedulesWithValidScore = schedulesWithScores.filter((s) => s.score !== null).length;
      console.log(
        `Schedules with valid scores: ${schedulesWithValidScore} / ${schedulesWithScores.length}`
      );

      // Sort by professor scores if requested
      if (rankByProfessor) {
        console.log("Sorting schedules by professor scores...");
        schedulesWithScores.sort((a, b) => {
          if (a.score === null && b.score === null) return 0;
          if (a.score === null) return 1;
          if (b.score === null) return -1;
          return b.score - a.score;
        });
        console.log(`Sorted ${schedulesWithScores.length} schedules by score`);
      }

      setSchedules(schedulesWithScores);
      toast.success(`Generated ${schedulesWithScores.length} schedules successfully!`, { id: loadingToastId });
    } catch (err) {
      console.error("Error generating schedules:", err);
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(`Failed to generate schedules: ${errorMessage}`, { id: loadingToastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
            Course Scheduler
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Generate optimal course schedules for uOttawa
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <ConfigForm
              initialConfig={config}
              onSubmit={handleGenerateSchedules}
              isLoading={isLoading}
            />

            <div className="mt-4 space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearAllCaches();
                  toast.success("All caches cleared successfully");
                }}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Caches
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDevMode(!showDevMode)}
                className="w-full"
              >
                <Settings className="h-4 w-4 mr-2" />
                {showDevMode ? "Hide" : "Show"} Developer Mode
              </Button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {schedules.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    Showing {displayedSchedules.length} of {schedules.length} schedules
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={viewMode === "list" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                    >
                      <List className="h-4 w-4 mr-1" />
                      List
                    </Button>
                    <Button
                      variant={viewMode === "calendar" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("calendar")}
                    >
                      <Calendar className="h-4 w-4 mr-1" />
                      Calendar
                    </Button>
                  </div>
                </div>

                {schedules.length > 10 && (
                  <div className="flex items-center justify-center gap-4 pb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        Page {currentPage} of {totalPages}
                      </span>
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">•</span>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          value={pageSize}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (val > 0) {
                              setPageSize(val);
                              setCurrentPage(1);
                            }
                          }}
                          className="w-16 h-8 text-center"
                        />
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">per page</span>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}

                <div className="space-y-4">
                  {displayedSchedules.map((item, idx) =>
                    viewMode === "list" ? (
                      <div key={startIndex + idx}>
                        <div className="flex items-center justify-between mb-2 px-1">
                          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            Schedule #{startIndex + idx + 1}
                          </span>
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            Score: {item.score !== null ? (
                              <span className="font-semibold text-blue-600 dark:text-blue-400">{item.score.toFixed(2)}</span>
                            ) : (
                              <span className="text-zinc-400 dark:text-zinc-500">N/A</span>
                            )}
                          </span>
                        </div>
                        <ScheduleListView
                          schedule={item.schedule}
                          scheduleNumber={startIndex + idx + 1}
                        />
                      </div>
                    ) : (
                      <div key={startIndex + idx}>
                        <div className="flex items-center justify-between mb-2 px-1">
                          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            Schedule #{startIndex + idx + 1}
                          </span>
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            Score: {item.score !== null ? (
                              <span className="font-semibold text-blue-600 dark:text-blue-400">{item.score.toFixed(2)}</span>
                            ) : (
                              <span className="text-zinc-400 dark:text-zinc-500">N/A</span>
                            )}
                          </span>
                        </div>
                        <ScheduleCalendarView
                          schedule={item.schedule}
                          scheduleNumber={startIndex + idx + 1}
                        />
                      </div>
                    )
                  )}
                </div>
              </>
            )}

            {!isLoading && schedules.length === 0 && !error && (
              <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                Configure your courses and click &quot;Generate Schedules&quot; to get started
              </div>
            )}

            {isLoading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-50"></div>
                <p className="mt-4 text-zinc-600 dark:text-zinc-400">
                  Generating schedules...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Developer Mode Section */}
        {showDevMode && (
          <div className="border-t-2 border-red-500 pt-8">
            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="text-red-600 dark:text-red-400 text-2xl">⚠️</div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-red-900 dark:text-red-100 mb-2">
                    Developer Mode
                  </h3>
                  <p className="text-sm text-red-800 dark:text-red-200 mb-4">
                    <strong>WARNING:</strong> These settings affect how the app fetches and caches data. 
                    Modifying these parameters may result in slower performance, increased API requests, 
                    or unexpected behavior. Only change these settings if you know what you&apos;re doing.
                  </p>
                  
                  <div className="space-y-4 mt-4">
                    <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded border border-red-200 dark:border-red-800">
                      <div className="flex-1">
                        <label className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 block mb-1">
                          Rank by Professor Scores
                        </label>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                          When enabled (default), schedules are ranked by professor ratings and grades. 
                          This requires fetching professor data and may take longer. Disable for faster generation without ranking.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={rankByProfessor}
                        onChange={(e) => {
                          const newValue = e.target.checked;
                          setRankByProfessor(newValue);
                          toast.success(
                            newValue 
                              ? "Schedules will be ranked by professor scores" 
                              : "Professor ranking disabled"
                          );
                        }}
                        className="h-5 w-5 rounded border-zinc-300 ml-4"
                      />
                    </div>

                    <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded border border-red-200 dark:border-red-800">
                      <div className="flex-1">
                        <label className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 block mb-1">
                          Always Use Professor Cache
                        </label>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                          When enabled (default), professor ratings are cached permanently and never re-fetched. 
                          This prevents unnecessary API calls to uo.zone. Disable only if you need fresh professor data.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={alwaysUseProfCache}
                        onChange={(e) => {
                          const newValue = e.target.checked;
                          setAlwaysUseProfCache(newValue);
                          setAlwaysUseProfessorCache(newValue);
                          toast.success(
                            newValue 
                              ? "Professor cache will always be used" 
                              : "Professor data will be re-fetched when needed"
                          );
                        }}
                        className="h-5 w-5 rounded border-zinc-300 ml-4"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          clearProfessorCache();
                          toast.success("Professor cache cleared");
                        }}
                        className="flex-1"
                      >
                        Clear Professor Cache Only
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          resetDevSettings();
                          setAlwaysUseProfCache(true);
                          setRankByProfessor(false);
                          toast.success("Dev settings reset to defaults");
                        }}
                        className="flex-1"
                      >
                        Reset to Defaults
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
