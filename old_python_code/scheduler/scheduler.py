import json
import itertools
import argparse
import os
import time
from typing import List, Dict, Tuple, Optional
from collections import defaultdict
from tabulate import tabulate

from .models import Section, Component
from .gatherer import get_sections, is_french, language_equivalent
from .prof_scoring import fetch_all_prof_data, calculate_schedule_score


DAY_MAP = {'MO': 0, 'TU': 1, 'WE': 2, 'TH': 3, 'FR': 4, 'SA': 5, 'SU': 6}
DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

# Cache configuration
SCHEDULER_CACHE_FILE = 'scheduler_cache.json'
SCHEDULER_CACHE_EXPIRY = 300  # 5 minutes in seconds


def load_config(config_path: str = 'config.json') -> Dict:
    """Load configuration from config.json."""
    with open(config_path, 'r') as f:
        return json.load(f)


def load_scheduler_cache() -> Dict:
    """Load scheduler cache from file."""
    if os.path.exists(SCHEDULER_CACHE_FILE):
        with open(SCHEDULER_CACHE_FILE, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return {}
    return {}


def save_scheduler_cache(data: Dict):
    """Save scheduler cache to file."""
    with open(SCHEDULER_CACHE_FILE, 'w') as f:
        json.dump(data, f, indent=2)


def is_cache_valid(cache_entry: Dict, unavailable_components: List[Dict]) -> bool:
    """
    Check if cache entry is still valid (less than 5 minutes old and same unavailable components).
    """
    if 'timestamp' not in cache_entry:
        return False
    current_time = time.time()
    cache_time = cache_entry['timestamp']
    
    # Check time expiry
    if (current_time - cache_time) >= SCHEDULER_CACHE_EXPIRY:
        return False
    
    # Check if unavailable_components have changed
    cached_unavailable = cache_entry.get('unavailable_components', [])
    if cached_unavailable != unavailable_components:
        return False
    
    return True


def get_cache_key(course_codes: List[str]) -> str:
    """Generate a cache key from course codes."""
    return ','.join(sorted(course_codes))


def parse_course_code(course_code: str) -> Tuple[str, str]:
    """Parse a course code like 'ITI1100' into subject and code."""
    # Assuming format is 3 letters + 4 digits
    subject = course_code[:3]
    code = course_code[3:]
    return subject, code


def fetch_all_sections(course_code: str, season: Optional[str] = None, year: Optional[int] = None) -> Dict[str, Dict[str, Section]]:
    """
    Fetch sections for a course in both English and French.
    Returns a dict with 'english' and 'french' keys, each containing sections dict.
    """
    subject, code = parse_course_code(course_code)
    
    # Get both English and French sections
    results = list(get_sections(subject, code, bilingual=True, season=season, year=year))
    
    # Determine which is English and which is French
    # The first result is for the original course code, second is for the language equivalent
    english_sections = {}
    french_sections = {}
    
    if is_french(code):
        # Original is French, equivalent is English
        french_sections = results[0] if len(results) > 0 else {}
        english_sections = results[1] if len(results) > 1 else {}
    else:
        # Original is English, equivalent is French
        english_sections = results[0] if len(results) > 0 else {}
        french_sections = results[1] if len(results) > 1 else {}
    
    return {
        'english': {sid: Section(**section_data) for sid, section_data in english_sections.items()},
        'french': {sid: Section(**section_data) for sid, section_data in french_sections.items()}
    }


def apply_unavailable_patches(courses_data: Dict[str, Dict[str, Dict[str, Section]]], 
                              unavailable_components: List[Dict]) -> int:
    """
    Apply patches to mark components as unavailable (closed).
    
    Args:
        courses_data: Dict mapping course codes to their section data
        unavailable_components: List of dicts with 'course' and 'component' keys
    
    Returns:
        Number of components patched
    """
    patched_count = 0
    
    for patch in unavailable_components:
        course_code = patch['course']
        component_label = patch['component']  # e.g., "A00-LEC", "B01-LAB"
        
        # Extract section ID from component (e.g., "B01-LAB" -> section "B", "A00-LEC" -> section "A")
        section_id = component_label.split('-')[0][0]  # First character before hyphen
        
        # Check if course_code exists directly, or if it's a language equivalent
        target_course = None
        if course_code in courses_data:
            target_course = course_code
        else:
            # Try to find the language equivalent in courses_data
            subject, code = parse_course_code(course_code)
            equivalent_code = language_equivalent(code)
            equivalent_course_code = subject + equivalent_code
            if equivalent_course_code in courses_data:
                target_course = equivalent_course_code
        
        if target_course is None:
            print(f"  Warning: Course {course_code} not found (tried {course_code} and its language equivalent)")
            continue
        
        # Check both English and French sections
        for lang in ['english', 'french']:
            if section_id in courses_data[target_course][lang]:
                section = courses_data[target_course][lang][section_id]
                # Search through all components to find matching label
                for comp_guid, component in section.components.items():
                    if component.label == component_label:
                        # Mark component as CLOSED
                        component.status = 'CLOSED'
                        patched_count += 1
                        # Display with the user's specified course code, not the internal one
                        print(f"  Patched {course_code} Section {section_id} - {component_label}: marked as CLOSED")
    
    return patched_count


def serialize_sections(sections_data: Dict[str, Dict[str, Section]]) -> Dict:
    """Convert Section objects to dictionaries for caching."""
    return {
        'english': {sid: section.model_dump() for sid, section in sections_data['english'].items()},
        'french': {sid: section.model_dump() for sid, section in sections_data['french'].items()}
    }


def deserialize_sections(serialized_data: Dict) -> Dict[str, Dict[str, Section]]:
    """Convert cached dictionaries back to Section objects."""
    return {
        'english': {sid: Section(**section_data) for sid, section_data in serialized_data['english'].items()},
        'french': {sid: Section(**section_data) for sid, section_data in serialized_data['french'].items()}
    }


def component_to_time_tuple(component: Component) -> Tuple[int, int, int]:
    """Convert a Component to a time tuple (day, start_minutes, end_minutes)."""
    day_idx = DAY_MAP[component.day]
    start_minutes = component.start_timestamp // 60
    end_minutes = component.end_timestamp // 60
    return (day_idx, start_minutes, end_minutes)


def times_conflict(t1: Tuple[int, int, int], t2: Tuple[int, int, int]) -> bool:
    """Check if two time tuples conflict."""
    return t1[0] == t2[0] and not (t1[2] <= t2[1] or t2[2] <= t1[1])


def generate_section_options(section: Section) -> List[Dict]:
    """
    Generate all possible component combinations for a section.
    Returns a list of dicts, each containing a valid combination of components.
    - All lectures must be OPEN.
    - If a section has a component type (LAB, TUT, etc.), at least one must be OPEN.
    """
    # Group ALL components by type to check original requirements
    all_components_by_type = defaultdict(list)
    for comp in section.components.values():
        all_components_by_type[comp.type].append(comp)

    # Group OPEN components by type
    open_components_by_type = defaultdict(list)
    for comp in section.components.values():
        if comp.status == 'OPEN':
            open_components_by_type[comp.type].append(comp)

    # --- Validation Step 1: Check Lectures ---
    all_lectures = all_components_by_type.get('LEC', [])
    open_lectures = open_components_by_type.get('LEC', [])
    if len(all_lectures) > 0 and len(all_lectures) != len(open_lectures):
        return [] # Discard section if any lecture is not open

    # --- Validation Step 2: Check Other Required Components ---
    for comp_type in ['LAB', 'TUT', 'DGD', 'SEM', 'WRK']:
        # If the section was supposed to have this component type...
        if len(all_components_by_type.get(comp_type, [])) > 0:
            # ...but there are no open ones, then this section is invalid.
            if len(open_components_by_type.get(comp_type, [])) == 0:
                return [] # Discard section

    # --- Combination Generation Step ---
    # At this point, we know the section is valid. Now, generate combinations.
    
    # All open lectures are required
    required_lectures = open_lectures
    
    # For other components, create choices. If a type existed, we must pick one.
    # If it didn't exist, we represent that with [[]] for itertools.product.
    lab_choices = [[]]
    if len(all_components_by_type.get('LAB', [])) > 0:
        lab_choices = [[comp] for comp in open_components_by_type.get('LAB', [])]

    tut_choices = [[]]
    if len(all_components_by_type.get('TUT', [])) > 0:
        tut_choices = [[comp] for comp in open_components_by_type.get('TUT', [])]

    dgd_choices = [[]]
    if len(all_components_by_type.get('DGD', [])) > 0:
        dgd_choices = [[comp] for comp in open_components_by_type.get('DGD', [])]

    sem_choices = [[]]
    if len(all_components_by_type.get('SEM', [])) > 0:
        sem_choices = [[comp] for comp in open_components_by_type.get('SEM', [])]
        
    wrk_choices = [[]]
    if len(all_components_by_type.get('WRK', [])) > 0:
        wrk_choices = [[comp] for comp in open_components_by_type.get('WRK', [])]

    # Generate all combinations from the valid, open choices
    options = []
    for lab, tut, dgd, sem, wrk in itertools.product(lab_choices, tut_choices, dgd_choices, sem_choices, wrk_choices):
        all_components = required_lectures + lab + tut + dgd + sem + wrk
        
        options.append({
            'section': section,
            'components': all_components
        })
    
    return options


def count_languages(schedule_combo: List[Dict]) -> Tuple[int, int]:
    """
    Count the number of English and French courses in a schedule combination.
    Returns (english_count, french_count).
    """
    english_count = 0
    french_count = 0
    
    for option in schedule_combo:
        section = option['section']
        # Check the course_id and determine language based on the section's course
        # We need to track which language this section belongs to
        if hasattr(option, 'language'):
            if option['language'] == 'english':
                english_count += 1
            else:
                french_count += 1
    
    return english_count, french_count


def has_weekend_classes(schedule_combo: List[Dict]) -> bool:
    """
    Check if any component in the schedule is on Saturday or Sunday.
    Returns True if weekend classes exist, False otherwise.
    """
    for option in schedule_combo:
        for component in option['components']:
            if component.day in ['SA', 'SU']:
                return True
    return False


def count_unique_days(schedule_combo: List[Dict]) -> int:
    """
    Count the number of unique days that have classes in the schedule.
    """
    days_with_classes = set()
    for option in schedule_combo:
        for component in option['components']:
            if component.day:  # Make sure day is not None or empty
                days_with_classes.add(component.day)
    return len(days_with_classes)


def generate_all_schedules(courses_data: Dict[str, Dict], max_english: int, max_french: int, 
                          no_weekends: bool = False, max_days: Optional[int] = None) -> List[List[Dict]]:
    """
    Generate all valid schedules considering language constraints.
    
    Args:
        courses_data: Dict mapping course codes to their section data (with 'english' and 'french' keys)
        max_english: Maximum number of English courses (-1 means no limit, this is the priority language)
        max_french: Maximum number of French courses (-1 means no limit, this is the priority language)
        no_weekends: If True, filter out schedules with weekend classes
        max_days: Maximum number of days allowed (1-7). If None, no restriction.
    
    Returns:
        List of valid schedules
    """
    # Build all possible section choices for each course (one section per course)
    all_course_options = []
    course_codes = []
    
    for course_code, lang_sections in courses_data.items():
        course_codes.append(course_code)
        section_choices = []
        
        # For each English section, generate all possible component combinations within that section
        for section in lang_sections['english'].values():
            section_opts = generate_section_options(section)
            for opt in section_opts:
                opt['language'] = 'english'
                opt['course_code'] = course_code
                section_choices.append(opt)
        
        # For each French section, generate all possible component combinations within that section
        for section in lang_sections['french'].values():
            section_opts = generate_section_options(section)
            for opt in section_opts:
                opt['language'] = 'french'
                opt['course_code'] = course_code
                section_choices.append(opt)
        
        all_course_options.append(section_choices)
    
    # Calculate and print valid combinations
    total_valid_combos = 1
    for options in all_course_options:
        total_valid_combos *= len(options)
    
    print(f"Valid section/component combinations per course:")
    for course_code, options in zip(course_codes, all_course_options):
        print(f"  {course_code}: {len(options)} valid options")
    print(f"\nTotal valid combinations to check: {total_valid_combos}\n")
    
    # Generate all combinations
    valid_schedules = []
    total_checked = 0
    
    for combo in itertools.product(*all_course_options):
        total_checked += 1
        
        # Check language constraints early to avoid useless calculations
        english_count = sum(1 for opt in combo if opt['language'] == 'english')
        french_count = sum(1 for opt in combo if opt['language'] == 'french')
        
        # If max_english is -1, it's the priority (no limit), otherwise check the constraint
        if max_english != -1 and english_count > max_english:
            continue
        
        # If max_french is -1, it's the priority (no limit), otherwise check the constraint
        if max_french != -1 and french_count > max_french:
            continue
        
        # Check weekend constraint (only if enabled)
        if no_weekends and has_weekend_classes(combo):
            continue
        
        # Check max days constraint (only if enabled)
        if max_days is not None and count_unique_days(combo) > max_days:
            continue
        
        # Check for time conflicts
        all_times = []
        for option in combo:
            for component in option['components']:
                all_times.append(component_to_time_tuple(component))
        
        # Check all pairs for conflicts
        conflict = False
        for i in range(len(all_times)):
            for j in range(i + 1, len(all_times)):
                if times_conflict(all_times[i], all_times[j]):
                    conflict = True
                    break
            if conflict:
                break
        
        if not conflict:
            valid_schedules.append(combo)
    
    print(f"Checked {total_checked} combinations, found {len(valid_schedules)} valid schedules.")
    return valid_schedules


def print_schedule(schedule: List[Dict], schedule_num: int, show_calendar: bool = False):
    """Print a schedule in both list and calendar format."""
    print(f"\n{'='*80}")
    print(f"Schedule {schedule_num}")
    print(f"{'='*80}")
    
    # Count languages
    english_count = sum(1 for opt in schedule if opt['language'] == 'english')
    french_count = sum(1 for opt in schedule if opt['language'] == 'french')
    print(f"Language distribution: {english_count} English, {french_count} French\n")
    
    # Print list of courses and components
    for option in schedule:
        base_course_code = option['course_code']
        language = option['language']
        section = option['section']
        
        # Determine correct course code to display based on language
        subject, code = parse_course_code(base_course_code)
        display_code = code
        if language == 'french' and not is_french(code):
            display_code = language_equivalent(code)
        elif language == 'english' and is_french(code):
            display_code = language_equivalent(code)
        display_course_code = subject + display_code
        
        print(f"\n{display_course_code} ({language.capitalize()}) - Section {section.id}")
        print(f"  Instructor: {section.instructor}")
        print(f"  Required components to enroll:")
        
        for component in sorted(option['components'], key=lambda c: (c.type, c.id)):
            day = DAY_NAMES[DAY_MAP[component.day]][:3]
            print(f"    {component.label}: {day} {component.start_time}-{component.end_time} ({component.status})")
    
    # Create calendar view only if requested
    if show_calendar:
        print("\n" + "="*80)
        print("Weekly Calendar")
        print("="*80)
        
        # Initialize calendar grid (8:00 to 23:30, 30-minute slots)
        calendar = [['' for _ in range(6)] for _ in range(32)]
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        
        # Fill in the calendar
        for option in schedule:
            base_course_code = option['course_code']
            language = option['language']
            
            # Determine correct course code to display based on language
            subject, code = parse_course_code(base_course_code)
            display_code = code
            if language == 'french' and not is_french(code):
                display_code = language_equivalent(code)
            elif language == 'english' and is_french(code):
                display_code = language_equivalent(code)
            display_course_code = subject + display_code

            for component in option['components']:
                day_idx = DAY_MAP[component.day]
                if day_idx >= 6:  # Skip Sunday
                    continue
                
                start_minutes = component.start_timestamp // 60
                end_minutes = component.end_timestamp // 60
                start_slot = (start_minutes - 480) // 30  # 480 = 8:00 AM
                end_slot = (end_minutes - 480) // 30
                
                if start_slot >= 0 and start_slot < 32:
                    for slot in range(start_slot, min(end_slot, 32)):
                        calendar[slot][day_idx] = f"{display_course_code}\n{component.label}"
        
        # Create time labels
        time_labels = []
        for hour in range(8, 24):
            time_labels.append(f"{hour:02d}:00")
            time_labels.append(f"{hour:02d}:30")
        
        # Prepare table data
        table_data = []
        for i in range(len(calendar)):
            if i < len(time_labels):
                row = [time_labels[i]] + calendar[i]
                table_data.append(row)
        
        # Print the calendar
        headers = ['Time'] + days
        print(tabulate(table_data, headers=headers, tablefmt="grid"))


def export_schedules_to_json(schedules: List[List[Dict]], output_file: str = 'schedules.json'):
    """Export all schedules to a JSON file."""
    export_data = []
    
    for idx, schedule in enumerate(schedules, 1):
        schedule_data = {
            'schedule_number': idx,
            'english_count': sum(1 for opt in schedule if opt['language'] == 'english'),
            'french_count': sum(1 for opt in schedule if opt['language'] == 'french'),
            'courses': []
        }
        
        for option in schedule:
            base_course_code = option['course_code']
            language = option['language']
            
            # Determine correct course code to display based on language
            subject, code = parse_course_code(base_course_code)
            display_code = code
            if language == 'french' and not is_french(code):
                display_code = language_equivalent(code)
            elif language == 'english' and is_french(code):
                display_code = language_equivalent(code)
            display_course_code = subject + display_code
            
            course_info = {
                'course_code': display_course_code,
                'language': language,
                'section_id': option['section'].id,
                'instructor': option['section'].instructor,
                'components': []
            }
            
            for component in option['components']:
                course_info['components'].append({
                    'label': component.label,
                    'type': component.type,
                    'day': component.day,
                    'start_time': component.start_time,
                    'end_time': component.end_time,
                    'status': component.status,
                    'room': component.room
                })
            
            schedule_data['courses'].append(course_info)
        
        export_data.append(schedule_data)
    
    with open(output_file, 'w') as f:
        json.dump(export_data, f, indent=2)
    
    print(f"\nExported {len(schedules)} schedules to {output_file}")


def main():
    """Main function to generate and display all valid schedules."""
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='Generate course schedules')
    parser.add_argument('--calendar', action='store_true', 
                        help='Show calendar view for schedules')
    parser.add_argument('--print', action='store_true',
                        help='Print schedules to console (default: export to file)')
    parser.add_argument('--max-display', type=int, default=None,
                        help='Maximum number of schedules to display when printing (default: all)')
    parser.add_argument('--output', type=str, default='schedules.json',
                        help='Output file for schedules (default: schedules.json)')
    parser.add_argument('--rank-by-prof', action='store_true',
                        help='Rank schedules by professor scores')
    parser.add_argument('--no-cache', action='store_true',
                        help='Disable all caching (both scheduler and professor data)')
    parser.add_argument('--clear-prof-cache', action='store_true',
                        help='Clear professor data cache before running')
    parser.add_argument('--logging', action='store_true',
                        help='Enable logging/debug output')
    parser.add_argument('--no-weekends', action='store_true',
                        help='Exclude schedules with weekend classes')
    parser.add_argument('--max-days', type=int, default=None,
                        help='Maximum number of days per week (1-7)')
    args = parser.parse_args()
    
    # Set logging state
    from . import uogrades
    from . import prof_scoring
    uogrades.LOGGING_ENABLED = args.logging
    
    # Clear professor cache if requested
    if args.clear_prof_cache:
        print("Clearing professor data cache...")
        for cache_file in [uogrades.PROF_ID_CACHE_FILE, uogrades.COURSE_DATA_CACHE_FILE, 
                          prof_scoring.PROF_SCORES_CACHE_FILE]:
            if os.path.exists(cache_file):
                os.remove(cache_file)
                print(f"  Removed {cache_file}")
        print()
    
    # Disable caching if requested
    if args.no_cache:
        uogrades.USE_CACHE = False
        prof_scoring.USE_CACHE = False
        print("Caching disabled for this run.\n")
    
    # Load configuration
    config = load_config('config.json')
    course_codes = config['courses']
    max_english = config['max_english']
    max_french = config['max_french']
    
    print("Fetching course sections...")
    print(f"Language constraints: max_english={max_english}, max_french={max_french}")
    print(f"Courses: {', '.join(course_codes)}\n")
    
    # Get unavailable components from config
    unavailable_components = config.get('unavailable_components', [])
    
    # Try to load from cache if not disabled
    courses_data = None
    cache_key = get_cache_key(course_codes)
    
    if not args.no_cache:
        scheduler_cache = load_scheduler_cache()
        if cache_key in scheduler_cache and is_cache_valid(scheduler_cache[cache_key], unavailable_components):
            print("Using cached course section data (less than 5 minutes old)...")
            try:
                courses_data = {
                    course_code: deserialize_sections(section_data)
                    for course_code, section_data in scheduler_cache[cache_key]['data'].items()
                }
                print(f"Loaded {len(courses_data)} courses from cache.\n")
            except Exception as e:
                print(f"Error loading cache: {e}")
                print("Fetching fresh data...\n")
                courses_data = None
    
    # Fetch fresh data if cache miss or disabled
    if courses_data is None:
        courses_data = {}
        for course_code in course_codes:
            print(f"Fetching {course_code}...")
            courses_data[course_code] = fetch_all_sections(course_code)
        
        # Apply unavailable component patches before caching
        if unavailable_components:
            print("\nApplying unavailable component patches:")
            patched_count = apply_unavailable_patches(courses_data, unavailable_components)
            if patched_count > 0:
                print(f"Total components patched: {patched_count}\n")
            else:
                print("No matching components found to patch.\n")
        
        # Save to cache if not disabled (with patches already applied)
        if not args.no_cache:
            scheduler_cache = load_scheduler_cache()
            scheduler_cache[cache_key] = {
                'timestamp': time.time(),
                'unavailable_components': unavailable_components,
                'data': {
                    course_code: serialize_sections(section_data)
                    for course_code, section_data in courses_data.items()
                }
            }
            save_scheduler_cache(scheduler_cache)
            print("Cached course section data for future runs.")

    
    # If ranking by professor, fetch all professor data BEFORE generating schedules
    prof_data_map = None
    if args.rank_by_prof:
        print("\nFetching professor data for ranking...")
        # Collect all unique instructor names from all sections
        all_instructors = set()
        for course_sections in courses_data.values():
            for section in course_sections['english'].values():
                all_instructors.add(section.instructor)
            for section in course_sections['french'].values():
                all_instructors.add(section.instructor)
        
        prof_data_map = fetch_all_prof_data(all_instructors)
        print(f"Fetched data for {len(prof_data_map)} professors.\n")
    
    print("\nGenerating schedules...\n")
    
    # Print constraint information
    if args.no_weekends:
        print("Filtering: No weekend classes")
    if args.max_days is not None:
        print(f"Filtering: Maximum {args.max_days} days per week")
    if args.no_weekends or args.max_days is not None:
        print()
    
    # Generate all valid schedules
    valid_schedules = generate_all_schedules(courses_data, max_english, max_french, 
                                            no_weekends=args.no_weekends, max_days=args.max_days)
    
    print(f"\nFound {len(valid_schedules)} valid schedules.")
    
    # If ranking by professor, calculate scores and sort
    if args.rank_by_prof and prof_data_map:
        print("\nRanking schedules by professor scores...")
        schedules_with_scores = []
        for schedule in valid_schedules:
            score = calculate_schedule_score(schedule, prof_data_map)
            if score is not None:
                schedules_with_scores.append((schedule, score))
        
        # Sort by score in descending order (highest score first)
        schedules_with_scores.sort(key=lambda x: x[1], reverse=True)
        valid_schedules = [s[0] for s in schedules_with_scores]
        
        print(f"Ranked {len(schedules_with_scores)} schedules with complete professor data.")
        if schedules_with_scores:
            print(f"Score range: {schedules_with_scores[-1][1]:.2f} to {schedules_with_scores[0][1]:.2f}")
    
    if len(valid_schedules) > 0:
        if args.print:
            # Print schedules to console
            num_to_display = len(valid_schedules) if args.max_display is None else min(args.max_display, len(valid_schedules))
            print(f"\nDisplaying {num_to_display} schedule(s):\n")
            for idx, schedule in enumerate(valid_schedules[:num_to_display], 1):
                print_schedule(schedule, idx, show_calendar=args.calendar)
        else:
            # Export to file
            export_schedules_to_json(valid_schedules, args.output)
    else:
        print("\nNo valid schedules found with the given constraints.")


if __name__ == '__main__':
    main()
