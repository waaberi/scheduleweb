"""
Professor scoring formula.

This module contains the scoring logic for ranking professors based on
RateMyProfessor data and uOttawa grade data.
"""

import json
import os
from .uogrades import get_relevant_data


PROF_SCORES_CACHE_FILE = 'prof_scores_cache.json'

# Toggle to disable caching (default: True = caching enabled)
USE_CACHE = True


def load_prof_scores_cache():
    """Load professor scores from cache file."""
    if not USE_CACHE:
        return {}
    if os.path.exists(PROF_SCORES_CACHE_FILE):
        with open(PROF_SCORES_CACHE_FILE, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return {}
    return {}


def save_prof_scores_cache(cache):
    """Save professor scores to cache file."""
    if USE_CACHE:
        with open(PROF_SCORES_CACHE_FILE, 'w') as f:
            json.dump(cache, f, indent=2)


def calculate_prof_score(prof_data):
    """
    Calculate a professor's score based on various metrics.
    
    Formula: rmp_rating - rmp_difficulty + prof_overall_grade + prof_overall_grade - avg_grade_in_courses
    
    Args:
        prof_data (dict): Dictionary containing:
            - rmp_rating: RateMyProfessor rating (higher is better)
            - rmp_difficulty: RateMyProfessor difficulty (lower is easier)
            - prof_overall_grade: Professor's overall grade average
            - avg_grade_in_courses: Average grade across all courses taught
    
    Returns:
        float: The calculated score, or None if required data is missing
    """
    if prof_data is None:
        return None
    
    required_keys = ['rmp_rating', 'rmp_difficulty', 'prof_overall_grade', 'avg_grade_in_courses']
    
    # Check if all required data is present
    for key in required_keys:
        if key not in prof_data or prof_data[key] is None:
            return None
    
    score = (
        prof_data['rmp_rating'] 
        - prof_data['rmp_difficulty'] 
        + prof_data['prof_overall_grade'] 
        + prof_data['prof_overall_grade'] 
        - prof_data['avg_grade_in_courses']
    )
    
    return round(score, 4)


def fetch_all_prof_data(instructor_names):
    """
    Fetch professor data for all instructors, using cache when available.
    
    Args:
        instructor_names (set or list): Set/list of instructor names to fetch data for
    
    Returns:
        dict: Dictionary mapping instructor names to their data and scores
    """
    cache = load_prof_scores_cache()
    prof_data_with_scores = {}
    
    for instructor in instructor_names:
        if instructor in cache:
            print(f"Using cached data for {instructor}")
            prof_data_with_scores[instructor] = cache[instructor]
        else:
            print(f"Fetching data for {instructor}...")
            prof_data = get_relevant_data(instructor)
            score = calculate_prof_score(prof_data)
            
            prof_data_with_scores[instructor] = {
                'data': prof_data,
                'score': score
            }
            
            # Save to cache immediately
            cache[instructor] = prof_data_with_scores[instructor]
            save_prof_scores_cache(cache)
    
    return prof_data_with_scores


def calculate_schedule_score(schedule, prof_data_map):
    """
    Calculate the total score for a schedule based on professor scores.
    
    Args:
        schedule (list): List of course options in the schedule
        prof_data_map (dict): Dictionary mapping instructor names to their data/scores
    
    Returns:
        float: Total score for the schedule (sum of all professor scores)
    """
    total_score = 0.0
    missing_profs = []
    
    for option in schedule:
        instructor = option['section'].instructor
        
        if instructor in prof_data_map and prof_data_map[instructor]['score'] is not None:
            total_score += prof_data_map[instructor]['score']
        else:
            missing_profs.append(instructor)
    
    # If any professors are missing scores, return None to indicate incomplete data
    if missing_profs:
        return None
    
    return round(total_score, 4)
