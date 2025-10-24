"""Module for fetching course section data from uSchedule API."""

import requests
import time
from typing import Optional, Iterator, Dict, Any


def is_french(course_code: str) -> bool:
    """Check if a course code is for a French course (5th character >= 5)."""
    return int(course_code[1]) >= 5


def language_equivalent(course_code: str) -> str:
    """Get the language equivalent of a course code (English <-> French)."""
    direction = (not is_french(course_code)) * 2 - 1
    tmp = int(course_code[1]) + 4 * direction
    l = list(course_code)
    l[1] = str(tmp)
    return ''.join(l)


def get_default_season() -> str:
    """Get the NEXT season based on the current month."""
    current_month = time.localtime().tm_mon

    if current_month <= 4:
        return "summer"
    elif current_month <= 8:
        return "fall"
    else:
        return "winter"


def get_default_year() -> int:
    """Get the current year unless you're looking for winter."""
    return time.localtime().tm_year + (get_default_season() == "winter")


def form_url(subject_id: str, course_code: str, season: str, year: int) -> str:
    """Form the API URL for fetching course data."""
    return (f"https://uschedule.me/api/scheduler/v1/courses/query/"
            f"?school=uottawa&course_code={course_code}&subject_code={subject_id}"
            f"&season={season}&year={year}")


def resolve_req(req: str) -> Dict[str, Any]:
    """Make a request to the API and return the sections data."""
    try:
        res = requests.get(req)
        res.raise_for_status()  # Raise an exception for bad status codes
        data = res.json()
        if data is None:
            return {}
        return data.get("data", {}).get("sections", {})
    except Exception as e:
        print(f"Error fetching data from {req}: {e}")
        return {}


def get_sections(
    subject_id: str,
    course_code: str,
    bilingual: bool = False,
    season: Optional[str] = None,
    year: Optional[int] = None
) -> Iterator[Dict[str, Any]]:
    """
    Fetch course sections from the uSchedule API.
    
    Args:
        subject_id: The subject code (e.g., 'ITI')
        course_code: The course code (e.g., '1100')
        bilingual: If True, fetch both English and French versions
        season: The season (winter, summer, fall). Defaults to current season.
        year: The year. Defaults to current year.
    
    Returns:
        An iterator of section data dictionaries
    """
    if season is None:
        season = get_default_season()
    if year is None:
        year = get_default_year()
    
    urls = []
    
    if bilingual:
        urls = [
            form_url(subject_id, course_code, season, year),
            form_url(subject_id, language_equivalent(course_code), season, year)
        ]
    else:
        urls = [form_url(subject_id, course_code, season, year)]
    
    return map(resolve_req, urls)
