import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProfessorSearchResponse {
  professors?: Array<{
    publicId: string;
    name: string;
  }>;
}

async function getProfessorId(instructorName: string): Promise<string | null> {
  try {
    const normalizedName = instructorName.trim();

    if (!normalizedName || normalizedName.toUpperCase() === "TBA") {
      console.log(`Skipping professor lookup for placeholder name: ${instructorName}`);
      return null;
    }

    const response = await fetch("https://uo.zone/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0",
      },
      body: JSON.stringify({ q: normalizedName }),
    });

    if (!response.ok) {
      console.error(`Failed to search for professor: ${response.status}`);
      return null;
    }

    const data: ProfessorSearchResponse = await response.json();
    const professors = data.professors || [];

    if (professors.length === 0) {
      console.log(`No professor found for: ${normalizedName}`);
      return null;
    }

    return professors[0].publicId;
  } catch (error) {
    console.error(`Error searching for professor ${instructorName}:`, error);
    return null;
  }
}

async function fetchCourseGrade(courseLink: string): Promise<number | null> {
  try {
    const courseUrl = `https://uo.zone${courseLink}`;
    const response = await fetch(courseUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch course page: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Find the grade element by looking for elements containing "Average"
    const gradeElements = $(".px-2 .h-5");
    let avgGrade: number | null = null;

    gradeElements.each((_i: number, element: any) => {
      const text = $(element).text();
      if (text.includes("Average")) {
        // Extract the grade from text like "Average: B+ (77%)"
        const match = text.match(/\((\d+)%\)/);
        if (match) {
          avgGrade = parseFloat(match[1]);
          return false; // break
        }
      }
    });

    return avgGrade;
  } catch (error) {
    console.error(`Error fetching course grade from ${courseLink}:`, error);
    return null;
  }
}

async function getProfessorData(instructorName: string) {
  const profId = await getProfessorId(instructorName);
  if (!profId) {
    return null;
  }

  const profUrl = `https://uo.zone/professor/${profId}`;

  try {
    const response = await fetch(profUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch professor page: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const parseNumeric = (value: string | undefined | null): number | null => {
      if (!value) return null;
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    // Extract RMP and uo.zone data
    const buttons = $("button[data-state='closed']");
    const buttonValue = (index: number): number | null => {
      const button = buttons.get(index);
      if (!button) return null;
      const text = $(button).text().trim();
      if (!text) return null;
      return parseNumeric(text.split(/\s+/)[0]);
    };

    const rmpRating = buttonValue(0);
    const rmpDifficulty = buttonValue(1);
    const totalRatings = buttonValue(2);

    const gradeElements = $(".px-2 .h-5");
    const profAverageText = gradeElements.get(4) ? $(gradeElements[4]).text() : null;
    const profAverageMatch = profAverageText ? profAverageText.match(/\((\d+)%\)/) : null;
    const profAverage = profAverageMatch ? parseNumeric(profAverageMatch[1]) : null;

    // Fetch grades for each course taught
    const courseLinks = $(".stretched-link");
    const courseAverages: number[] = [];

    for (const link of courseLinks.toArray()) {
      const href = $(link).attr("href");
      if (href) {
        const grade = await fetchCourseGrade(href);
        if (grade !== null && Number.isFinite(grade)) {
          courseAverages.push(grade);
        }
      }
    }

    const overallCourseAvg =
      courseAverages.length > 0
        ? courseAverages.reduce((a, b) => a + b, 0) / courseAverages.length
        : null;

    return {
      rmp_rating: rmpRating,
      rmp_difficulty: rmpDifficulty,
      total_ratings: totalRatings,
      prof_overall_grade: profAverage,
      avg_grade_in_courses: overallCourseAvg,
    };
  } catch (error) {
    console.error(`Error fetching professor data for ${instructorName}:`, error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const instructor = searchParams.get("instructor");

    if (!instructor) {
      return NextResponse.json(
        { error: "instructor parameter is required" },
        { status: 400 }
      );
    }

    const professorData = await getProfessorData(instructor);

    if (!professorData) {
      return NextResponse.json(
        { error: "Professor data not found" },
        { status: 404 }
      );
    }

    // Return just the raw professor data
    return NextResponse.json(professorData);
  } catch (error) {
    console.error("Error in /api/professors:", error);
    return NextResponse.json(
      { error: "Failed to fetch professor data" },
      { status: 500 }
    );
  }
}
