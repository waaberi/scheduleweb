"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SectionOption } from "@/lib/types";
import { DAY_MAP, DAY_NAMES_SHORT } from "@/lib/types";
import { parseCourseCode, isFrench, languageEquivalent } from "@/lib/utils";

interface ScheduleCalendarViewProps {
  schedule: SectionOption[];
  scheduleNumber: number;
  score?: number;
}

export function ScheduleCalendarView({
  schedule,
  scheduleNumber,
  score,
}: ScheduleCalendarViewProps) {
  const englishCount = schedule.filter((opt) => opt.language === "english").length;
  const frenchCount = schedule.filter((opt) => opt.language === "french").length;

  // Initialize calendar grid (8:00 AM to 10:00 PM, 30-minute slots)
  // 14 hours * 2 slots per hour = 28 slots
  const startHour = 8;
  const endHour = 22;
  const slotsPerHour = 2;
  const totalSlots = (endHour - startHour) * slotsPerHour;

  // Days: Monday to Saturday (0-5)
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Store course blocks for rendering as overlays
  interface CourseBlock {
    course: string;
    component: string;
    dayIdx: number;
    startSlot: number;
    endSlot: number;
    color: string;
  }

  const courseBlocks: CourseBlock[] = [];
  const courseColors = [
    "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 border-blue-300 dark:border-blue-700",
    "bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100 border-green-300 dark:border-green-700",
    "bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100 border-purple-300 dark:border-purple-700",
    "bg-orange-100 dark:bg-orange-900 text-orange-900 dark:text-orange-100 border-orange-300 dark:border-orange-700",
    "bg-pink-100 dark:bg-pink-900 text-pink-900 dark:text-pink-100 border-pink-300 dark:border-pink-700",
    "bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100 border-yellow-300 dark:border-yellow-700",
    "bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100 border-red-300 dark:border-red-700",
    "bg-indigo-100 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 border-indigo-300 dark:border-indigo-700",
  ];

  // Assign colors to courses
  const courseColorMap: Record<string, string> = {};
  let colorIndex = 0;

  // Fill in the calendar
  for (const option of schedule) {
    const baseCourseCode = option.course_code;
    const language = option.language;

    // Determine correct course code to display
    const { subject, code } = parseCourseCode(baseCourseCode);
    let displayCode = code;
    if (language === "french" && !isFrench(code)) {
      displayCode = languageEquivalent(code);
    } else if (language === "english" && isFrench(code)) {
      displayCode = languageEquivalent(code);
    }
    const displayCourseCode = subject + displayCode;

    // Assign color to course if not already assigned
    if (!courseColorMap[displayCourseCode]) {
      courseColorMap[displayCourseCode] = courseColors[colorIndex % courseColors.length];
      colorIndex++;
    }

    for (const component of option.components) {
      const dayIdx = DAY_MAP[component.day];
      if (dayIdx >= 6) continue; // Skip Sunday

      const startMinutes = component.start_timestamp / 60;
      const endMinutes = component.end_timestamp / 60;
      const startSlot = Math.floor((startMinutes - startHour * 60) / 30);
      const endSlot = Math.floor((endMinutes - startHour * 60) / 30);

      if (startSlot >= 0 && startSlot < totalSlots) {
        courseBlocks.push({
          course: displayCourseCode,
          component: component.label,
          dayIdx,
          startSlot,
          endSlot: Math.min(endSlot, totalSlots),
          color: courseColorMap[displayCourseCode],
        });
      }
    }
  }

  // Generate time labels
  const timeLabels: string[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    timeLabels.push(`${hour.toString().padStart(2, "0")}:00`);
    timeLabels.push(`${hour.toString().padStart(2, "0")}:30`);
  }

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
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header row with days */}
            <div className="grid grid-cols-7 border-b-2 border-zinc-300 dark:border-zinc-700">
              <div className="bg-zinc-100 dark:bg-zinc-900 p-3 font-semibold text-sm border-r border-zinc-300 dark:border-zinc-700">
                Time
              </div>
              {days.map((day) => (
                <div
                  key={day}
                  className="bg-zinc-100 dark:bg-zinc-900 p-3 font-semibold text-sm text-center border-r border-zinc-300 dark:border-zinc-700 last:border-r-0"
                >
                  {day.slice(0, 3)}
                </div>
              ))}
            </div>

            {/* Calendar grid container */}
            <div className="relative border border-zinc-300 dark:border-zinc-700 border-t-0">
              {/* Time labels and grid cells */}
              <div className="grid grid-cols-7">
                {timeLabels.map((time, slotIdx) => (
                  <React.Fragment key={`slot-${slotIdx}`}>
                    {/* Time label */}
                    <div 
                      className="bg-zinc-50 dark:bg-zinc-900 p-2 text-xs text-zinc-600 dark:text-zinc-400 font-medium border-r border-b border-zinc-200 dark:border-zinc-800 flex items-start"
                      style={{ height: '40px' }}
                    >
                      {time}
                    </div>
                    {/* Day cells */}
                    {days.map((day, dayIdx) => (
                      <div
                        key={`${slotIdx}-${dayIdx}`}
                        className="bg-white dark:bg-zinc-950 border-r border-b border-zinc-200 dark:border-zinc-800 last:border-r-0"
                        style={{ height: '40px' }}
                      />
                    ))}
                  </React.Fragment>
                ))}
              </div>

              {/* Overlay course blocks */}
              <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none">
                {courseBlocks.map((block, idx) => {
                  const height = (block.endSlot - block.startSlot) * 40;
                  const top = block.startSlot * 40;
                  // Calculate column position accounting for time column
                  const columnWidth = 100 / 7;
                  const left = columnWidth + (block.dayIdx * columnWidth);
                  
                  return (
                    <div
                      key={idx}
                      className={`absolute border-2 rounded-md shadow-sm ${block.color}`}
                      style={{
                        top: `${top}px`,
                        left: `calc(${left}% + 2px)`,
                        width: `calc(${columnWidth}% - 4px)`,
                        height: `${height}px`,
                        padding: '4px 6px',
                      }}
                    >
                      <div className="font-semibold text-xs truncate leading-tight">
                        {block.course}
                      </div>
                      <div className="text-[10px] truncate opacity-90 mt-0.5">
                        {block.component}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
