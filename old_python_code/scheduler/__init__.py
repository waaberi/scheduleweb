"""Scheduler package for generating course schedules."""

from .models import Component, Section, SectionData
from .gatherer import get_sections, is_french, language_equivalent
from .scheduler import main

__all__ = [
    'Component',
    'Section',
    'SectionData',
    'get_sections',
    'is_french',
    'language_equivalent',
    'main',
]
