import { NextRequest, NextResponse } from "next/server";
import { parseCourseCode, languageEquivalent, isFrench } from "@/lib/utils";
import type { Season } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FetchCoursesParams {
  subject: string;
  code: string;
  season: Season;
  year: number;
  bilingual: boolean;
}

async function fetchSections(
  subject: string,
  courseCode: string,
  season: string,
  year: number
) {
  const url = `https://uschedule.me/api/scheduler/v1/courses/query/?school=uottawa&course_code=${courseCode}&subject_code=${subject}&season=${season}&year=${year}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SchedulerApp/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data?.data?.sections || {};
  } catch (error) {
    console.error(`Error fetching sections from ${url}:`, error);
    return {};
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const courseCode = searchParams.get("courseCode");
    const season = (searchParams.get("season") || "fall") as Season;
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const bilingual = searchParams.get("bilingual") === "true";

    if (!courseCode) {
      return NextResponse.json(
        { error: "courseCode parameter is required" },
        { status: 400 }
      );
    }

    const { subject, code } = parseCourseCode(courseCode);

    const results: Record<string, any> = {};

    if (bilingual) {
      // Fetch both English and French versions
      const originalSections = await fetchSections(subject, code, season, year);
      const equivalentCode = languageEquivalent(code);
      const equivalentSections = await fetchSections(
        subject,
        equivalentCode,
        season,
        year
      );

      if (isFrench(code)) {
        // Original is French, equivalent is English
        results.french = originalSections;
        results.english = equivalentSections;
      } else {
        // Original is English, equivalent is French
        results.english = originalSections;
        results.french = equivalentSections;
      }
    } else {
      // Fetch only requested version
      const sections = await fetchSections(subject, code, season, year);
      results[isFrench(code) ? "french" : "english"] = sections;
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error in /api/courses:", error);
    return NextResponse.json(
      { error: "Failed to fetch course data" },
      { status: 500 }
    );
  }
}
