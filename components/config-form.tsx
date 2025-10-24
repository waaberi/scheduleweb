"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Plus } from "lucide-react";
import type { ScheduleConfig } from "@/lib/types";

interface ConfigFormProps {
  initialConfig?: ScheduleConfig;
  onSubmit: (config: ScheduleConfig) => void;
  isLoading?: boolean;
}

export function ConfigForm({ initialConfig, onSubmit, isLoading }: ConfigFormProps) {
  const [courses, setCourses] = useState<string[]>([]);
  const [newCourse, setNewCourse] = useState("");
  const [maxEnglish, setMaxEnglish] = useState("-1");
  const [maxFrench, setMaxFrench] = useState("-1");
  const [unavailableComponents, setUnavailableComponents] = useState<
    Array<{ course: string; component: string }>
  >([]);
  const [newUnavailableCourse, setNewUnavailableCourse] = useState("");
  const [newUnavailableComponent, setNewUnavailableComponent] = useState("");
  const [noWeekends, setNoWeekends] = useState(false);
  const [maxDays, setMaxDays] = useState("");

  // Update form state when initialConfig changes
  useEffect(() => {
    if (initialConfig) {
      setCourses(initialConfig.courses || []);
      setMaxEnglish(initialConfig.max_english?.toString() || "-1");
      setMaxFrench(initialConfig.max_french?.toString() || "-1");
      setUnavailableComponents(initialConfig.unavailable_components || []);
      setNoWeekends(initialConfig.no_weekends || false);
      setMaxDays(initialConfig.max_days?.toString() || "");
    }
  }, [initialConfig]);

  const addCourse = () => {
    if (newCourse && !courses.includes(newCourse.toUpperCase())) {
      setCourses([...courses, newCourse.toUpperCase()]);
      setNewCourse("");
    }
  };

  const removeCourse = (course: string) => {
    setCourses(courses.filter((c) => c !== course));
  };

  const addUnavailableComponent = () => {
    if (newUnavailableCourse && newUnavailableComponent) {
      setUnavailableComponents([
        ...unavailableComponents,
        {
          course: newUnavailableCourse.toUpperCase(),
          component: newUnavailableComponent.toUpperCase(),
        },
      ]);
      setNewUnavailableCourse("");
      setNewUnavailableComponent("");
    }
  };

  const removeUnavailableComponent = (index: number) => {
    setUnavailableComponents(unavailableComponents.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      courses,
      max_english: parseInt(maxEnglish),
      max_french: parseInt(maxFrench),
      unavailable_components: unavailableComponents,
      no_weekends: noWeekends,
      max_days: maxDays ? parseInt(maxDays) : undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule Configuration</CardTitle>
        <CardDescription>
          Configure your course preferences and constraints
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Courses */}
          <div className="space-y-2">
            <Label>Courses</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., ITI1100"
                value={newCourse}
                onChange={(e) => setNewCourse(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCourse();
                  }
                }}
              />
              <Button type="button" onClick={addCourse} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {courses.map((course) => (
                <div
                  key={course}
                  className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-md"
                >
                  <span className="text-sm">{course}</span>
                  <button
                    type="button"
                    onClick={() => removeCourse(course)}
                    className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Language Constraints */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxEnglish">Max English Courses</Label>
              <Input
                id="maxEnglish"
                type="number"
                value={maxEnglish}
                onChange={(e) => setMaxEnglish(e.target.value)}
                placeholder="-1 for unlimited"
              />
              <p className="text-xs text-zinc-500">-1 for no limit</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxFrench">Max French Courses</Label>
              <Input
                id="maxFrench"
                type="number"
                value={maxFrench}
                onChange={(e) => setMaxFrench(e.target.value)}
                placeholder="-1 for unlimited"
              />
              <p className="text-xs text-zinc-500">-1 for no limit</p>
            </div>
          </div>

          {/* Additional Filters */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxDays">Max Days Per Week</Label>
              <Input
                id="maxDays"
                type="number"
                min="1"
                max="7"
                value={maxDays}
                onChange={(e) => setMaxDays(e.target.value)}
                placeholder="Leave empty for no limit"
              />
            </div>
            <div className="flex items-center space-x-2 pt-8">
              <input
                type="checkbox"
                id="noWeekends"
                checked={noWeekends}
                onChange={(e) => setNoWeekends(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              <Label htmlFor="noWeekends" className="cursor-pointer">
                No Weekend Classes
              </Label>
            </div>
          </div>

          {/* Unavailable Components */}
          <div className="space-y-2">
            <Label>Unavailable Components (Optional)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Course (e.g., MAT1322)"
                value={newUnavailableCourse}
                onChange={(e) => setNewUnavailableCourse(e.target.value)}
              />
              <Input
                placeholder="Component (e.g., E00-LEC)"
                value={newUnavailableComponent}
                onChange={(e) => setNewUnavailableComponent(e.target.value)}
              />
              <Button type="button" onClick={addUnavailableComponent} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1 mt-2">
              {unavailableComponents.map((comp, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-md"
                >
                  <span className="text-sm">
                    {comp.course} - {comp.component}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeUnavailableComponent(index)}
                    className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading || courses.length === 0}>
            {isLoading ? "Generating Schedules..." : "Generate Schedules"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
