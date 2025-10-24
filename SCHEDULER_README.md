# Course Scheduler Web App

A Next.js web application that generates optimal course schedules for uOttawa students. This is a web port of the Python scheduler application with additional features and improvements.

## Features

- 🎓 **Course Selection**: Add multiple courses to generate schedules
- 🌐 **Bilingual Support**: Automatically fetches both English and French sections
- 🔒 **Language Constraints**: Set maximum number of English/French courses
- ❌ **Unavailable Components**: Mark specific sections as unavailable
- 📅 **Flexible Filtering**: 
  - No weekend classes option
  - Maximum days per week constraint
- 👨‍🏫 **Professor Ranking**: Optionally rank schedules by professor scores (RateMyProfessor + uOttawa grades)
- 📊 **Multiple Views**: 
  - List view for detailed course information
  - Calendar view for visual schedule layout
- 💾 **Client-Side Caching**: All data cached in localStorage for faster subsequent loads
- 🔄 **Smart Caching**: 5-minute cache expiry with automatic invalidation

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Run the development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

## How to Use

### 1. Configure Your Schedule

1. **Add Courses**: Enter course codes (e.g., `ITI1100`, `MAT1348`) and click the + button
2. **Set Language Constraints**:
   - Max English Courses: `-1` for unlimited, or a specific number
   - Max French Courses: `-1` for unlimited, or a specific number
3. **Optional Filters**:
   - Max Days Per Week: Limit how many days you want classes
   - No Weekend Classes: Check to exclude Saturday/Sunday classes
4. **Unavailable Components** (Optional):
   - Mark specific sections/components you cannot attend
   - Format: Course (e.g., `MAT1322`) + Component (e.g., `E00-LEC`)

### 2. Generate Schedules

Click **"Generate Schedules"** to start the process. The app will:
- Fetch course data from uSchedule API
- Apply your constraints and filters
- Generate all valid schedule combinations
- Display results sorted by your preferences

### 3. View Results

- **List View**: See detailed course information, instructors, and component times
- **Calendar View**: Visualize your schedule on a weekly calendar grid
- Toggle between views using the List/Calendar buttons
- Load more schedules with the "Load More" button

### 4. Professor Ranking (Optional)

Check **"Rank by professor scores"** before generating to:
- Fetch professor data from uo.zone
- Calculate scores based on:
  - RateMyProfessor ratings
  - RateMyProfessor difficulty
  - Professor's overall grade average
  - Course-specific grade averages
- Sort schedules by total score (highest first)

**Note**: This is significantly slower as it requires fetching data for each professor.

## Architecture

### Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI primitives
- **Icons**: Lucide React
- **State Management**: React useState (client-side only)
- **Storage**: localStorage for caching

### Project Structure

```
scheduleweb/
├── app/
│   ├── api/
│   │   ├── courses/route.ts      # Proxy to uSchedule API
│   │   └── professors/route.ts   # Proxy to uo.zone
│   ├── layout.tsx
│   └── page.tsx                  # Main application page
├── components/
│   ├── ui/                       # Reusable UI components
│   ├── config-form.tsx           # Configuration form
│   ├── schedule-list-view.tsx    # List view component
│   └── schedule-calendar-view.tsx # Calendar view component
├── lib/
│   ├── types.ts                  # TypeScript type definitions
│   ├── utils.ts                  # Utility functions
│   ├── storage.ts                # localStorage utilities
│   └── scheduler.ts              # Schedule generation algorithm
└── old_python_code/              # Original Python implementation
```

### API Routes

All external requests are proxied through Next.js API routes (server-side) to:
- Avoid CORS issues
- Keep API keys secure (if needed in future)
- Add rate limiting/caching at the server level if needed

#### `/api/courses`
- Fetches course sections from uSchedule.me
- Supports bilingual fetching
- Query params: `courseCode`, `season`, `year`, `bilingual`

#### `/api/professors`
- Fetches professor data from uo.zone
- Scrapes RateMyProfessor ratings and grade data
- Query param: `instructor` (name)

### Client-Side Storage

All data except API requests is stored on the client:
- **Scheduler Cache**: Course section data (5-minute expiry)
- **Professor Cache**: Professor scores (permanent until cleared)
- **Config Cache**: User's last configuration

### Schedule Generation Algorithm

Ported from the Python version with the same logic:
1. Generate all valid component combinations per section
2. Create cartesian product of all course options
3. Filter by language constraints
4. Filter by weekend/max days constraints
5. Check for time conflicts
6. Optionally rank by professor scores

## Configuration Examples

### Example 1: All English, No Weekends
```json
{
  "courses": ["ITI1100", "ITI1121", "MAT1322"],
  "max_english": -1,
  "max_french": 0,
  "no_weekends": true
}
```

### Example 2: Mixed Languages, Max 4 Days
```json
{
  "courses": ["ITI1100", "MAT1348", "PHY1322"],
  "max_english": 2,
  "max_french": 1,
  "max_days": 4
}
```

### Example 3: With Unavailable Sections
```json
{
  "courses": ["MAT1322", "ITI1121"],
  "max_english": -1,
  "max_french": -1,
  "unavailable_components": [
    { "course": "MAT1322", "component": "E00-LEC" },
    { "course": "ITI1121", "component": "A00-LEC" }
  ]
}
```

## Clearing Caches

Click the **"Clear All Caches"** button to:
- Remove cached course section data
- Remove cached professor data
- Saved configuration will remain

This is useful if:
- Course sections have been updated
- You want to force a fresh data fetch
- localStorage is getting full

## Differences from Python Version

### Improvements
- ✅ Web-based interface (no command line)
- ✅ Real-time visual feedback
- ✅ Interactive configuration
- ✅ Calendar visualization
- ✅ Client-side caching (faster subsequent loads)
- ✅ Responsive design for mobile/tablet

### Limitations
- ⚠️ Professor ranking is slower (sequential API calls)
- ⚠️ No export to JSON file (can be added)
- ⚠️ Limited to browser localStorage size

## Contributing

To add new features or fix bugs:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for educational purposes. Please respect uOttawa's terms of service and uo.zone's usage policies.

## Credits

- Original Python implementation
- uSchedule.me for course data API
- uo.zone for professor ratings and grade data
- RateMyProfessor for professor ratings

## Support

For issues or questions:
- Check the browser console for detailed error messages
- Ensure you have a stable internet connection
- Try clearing caches if data seems stale
- Verify course codes are correct (e.g., `ITI1100`, not `ITI 1100`)
