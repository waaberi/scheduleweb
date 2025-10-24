import requests
from bs4 import BeautifulSoup
#import time
import json
import os
import random

# --- Cache and Session Setup ---

PROF_ID_CACHE_FILE = 'prof_id_cache.json'
COURSE_DATA_CACHE_FILE = 'course_data_cache.json'
SESSION = requests.Session()
SESSION.headers.update({'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0'})

# Toggle to disable caching for debugging (default: True = caching enabled)
USE_CACHE = True

# Toggle to enable logging/debug print statements (controlled by scheduler.py)
LOGGING_ENABLED = True

def log(message):
    """Print message only if logging is enabled."""
    if LOGGING_ENABLED:
        print(message)

def load_cache(file_path):
    """Loads a JSON cache file if it exists."""
    if os.path.exists(file_path):
        with open(file_path, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return {}
    return {}

def save_cache(file_path, data):
    """Saves data to a JSON cache file."""
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2)

# Load caches at startup
PROF_ID_CACHE = load_cache(PROF_ID_CACHE_FILE)
COURSE_DATA_CACHE = load_cache(COURSE_DATA_CACHE_FILE)


def get_prof_id(instructor):
    """
    Fetches a professor's public ID from uo.zone, with caching and rate-limiting awareness.
    """
    if USE_CACHE and instructor in PROF_ID_CACHE:
        log(f"Found cached ID for {instructor}.")
        return PROF_ID_CACHE[instructor]

    log(f"Fetching ID for {instructor}...")
    try:
        # Add a small, random delay to mimic human behavior
        
        response = SESSION.post("https://uo.zone/api/search", json={"q": instructor})
        response.raise_for_status()  # Raise an exception for bad status codes
        
        professors = response.json().get("professors", [])
        if not professors:
            log(f"No professor found for '{instructor}'.")
            return None
            
        prof_id = professors[0]["publicId"]
        
        # Cache the new ID and save immediately
        if USE_CACHE:
            PROF_ID_CACHE[instructor] = prof_id
            save_cache(PROF_ID_CACHE_FILE, PROF_ID_CACHE)
        
        return prof_id
        
    except requests.exceptions.RequestException as e:
        log(f"Error fetching professor ID for {instructor}: {e}")
        return None
    except (KeyError, IndexError):
        log(f"Could not parse professor ID from API response for {instructor}.")
        return None

def avg_grade_by_course(course_link):
    """
    Fetches the average grade for a single course, with caching.
    """
    course_url = f"https://uo.zone{course_link}"
    
    if USE_CACHE and course_url in COURSE_DATA_CACHE:
        log(f"Found cached grade for {course_link}.")
        return COURSE_DATA_CACHE[course_url]

    log(f"Fetching grade for {course_link}...")
    try:
        # Add a small, random delay
        
        response = SESSION.get(course_url)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find the grade element by looking for elements containing "Average"
        grade_elements = soup.select(".px-2 .h-5")
        avg_grade = None
        
        for element in grade_elements:
            element_text = element.text
            if "Average" in element_text:
                # Extract the grade from text like "Average: B+ (77%)"
                try:
                    avg_grade = float(element_text.split()[2][1:-1])
                    break
                except (ValueError, IndexError):
                    continue
        
        if avg_grade is None:
            log(f"Could not find average grade element for {course_link}.")
            return None
        
        # Cache the new grade and save immediately
        if USE_CACHE:
            COURSE_DATA_CACHE[course_url] = avg_grade
            save_cache(COURSE_DATA_CACHE_FILE, COURSE_DATA_CACHE)
        
        return avg_grade

    except requests.exceptions.RequestException as e:
        log(f"Error fetching course page {course_url}: {e}")
        return None
    except (ValueError, IndexError) as e:
        log(f"Error parsing average grade from {course_url}: {e}")
        return None

def get_relevant_data(instructor):
    """
    Gathers all relevant data for a professor, including RMP stats and average grades.
    """
    prof_id = get_prof_id(instructor)
    if prof_id is None:
        return None

    prof_url = f"https://uo.zone/professor/{prof_id}"
    log(f"Fetching main professor page: {prof_url}")

    try:
        response = SESSION.get(prof_url)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')

        # --- Safely extract RMP and uo.zone data ---
        rmp_rating = float(soup.select("button[data-state='closed']")[0].text.split()[0])
        rmp_difficulty = float(soup.select("button[data-state='closed']")[1].text.split()[0])
        total_ratings = float(soup.select("button[data-state='closed']")[2].text.split()[0])
        prof_average = float(soup.select(".px-2 .h-5")[4].text.split()[2][1:-1])

        # --- Fetch grades for each course taught ---
        stretched_links = soup.select(".stretched-link")
        course_averages = []
        for link in stretched_links:
            course_avg = avg_grade_by_course(link.get("href"))
            if course_avg is not None:
                course_averages.append(course_avg)
        
        if not course_averages:
            log(f"Could not fetch any course averages for {instructor}.")
            overall_course_avg = None
        else:
            overall_course_avg = round(sum(course_averages) / len(course_averages), 8)

        return {
            "rmp_rating": rmp_rating,
            "rmp_difficulty": rmp_difficulty,
            "total_ratings": total_ratings,
            "prof_overall_grade": prof_average,
            "avg_grade_in_courses": overall_course_avg
        }

    except requests.exceptions.RequestException as e:
        log(f"Failed to fetch professor page {prof_url}: {e}")
        return None
    except (ValueError, IndexError) as e:
        log(f"Failed to parse data from professor page {prof_url}: {e}")
        return None


if __name__ == '__main__':
    # Example: Run for a list of professors
    professors_to_check = ["Aneta Traikova", "Mohammad Al Ridhawi", "Tommaso Cesari"]
    all_prof_data = {}

    for prof in professors_to_check:
        log(f"\n{'='*20}\nProcessing: {prof}\n{'='*20}")
        data = get_relevant_data(prof)
        if data:
            all_prof_data[prof] = data
            log(f"Successfully processed {prof}.")
    
    log("\n\n--- All Collected Data ---")
    print(json.dumps(all_prof_data, indent=2))

