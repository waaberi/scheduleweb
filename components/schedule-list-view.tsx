"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SectionOption } from "@/lib/types";
import { DAY_NAMES_SHORT, DAY_MAP } from "@/lib/types";
import { parseCourseCode, isFrench, languageEquivalent } from "@/lib/utils";

interface ScheduleListViewProps {
  schedule: SectionOption[];
  scheduleNumber: number;
  score?: number;
}

export function ScheduleListView({ schedule, scheduleNumber, score }: ScheduleListViewProps) {
  const englishCount = schedule.filter((opt) => opt.language === "english").length;
  const frenchCount = schedule.filter((opt) => opt.language === "french").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Schedule {scheduleNumber}</span>
          {score !== undefined && (
            <span className="text-sm font-normal text-zinc-500">
              Score: {score.toFixed(2)}
            </span>
          )}
        </CardTitle>
        <p className="text-sm text-zinc-500">
          {englishCount} English, {frenchCount} French
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {schedule.map((option, idx) => {
          const baseCourseCode = option.course_code;
          const language = option.language;
          const section = option.section;

          // Determine correct course code to display based on language
          const { subject, code } = parseCourseCode(baseCourseCode);
          let displayCode = code;
          if (language === "french" && !isFrench(code)) {
            displayCode = languageEquivalent(code);
          } else if (language === "english" && isFrench(code)) {
            displayCode = languageEquivalent(code);
          }
          const displayCourseCode = subject + displayCode;

          return (
            <div key={idx} className="border-l-2 border-zinc-200 dark:border-zinc-800 pl-4">
              <div className="font-semibold">
                {displayCourseCode}{" "}
                <span className="text-sm font-normal text-zinc-500">
                  ({language}) - Section {section.id}
                </span>
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                Instructor: {section.instructor}
              </div>
              <div className="mt-2 space-y-1">
                <div className="text-sm font-medium text-zinc-500">Components:</div>
                {option.components
                  .sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id))
                  .map((component, cidx) => {
                    const day = DAY_NAMES_SHORT[DAY_MAP[component.day]];
                    return (
                      <div key={cidx} className="text-sm text-zinc-600 dark:text-zinc-400 ml-4">
                        {component.label}: {day} {component.start_time}-{component.end_time}
                        {component.room && ` in ${component.room}`}
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
