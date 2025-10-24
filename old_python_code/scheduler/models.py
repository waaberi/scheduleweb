"""Pydantic models for section data."""

from typing import Dict, Literal, Optional
from pydantic import BaseModel, Field


class Component(BaseModel):
    """Represents a single component (lecture, lab, tutorial) of a section."""
    
    course_id: int
    section_id: str
    id: str
    guid: str
    label: str
    status: Literal["OPEN", "CLOSED", "FULL", "WAITLIST"]
    type: Literal["LEC", "LAB", "TUT", "DGD", "SEM", "WRK"]
    day: Literal["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
    start_timestamp: int
    start_time: str
    start_time_12hr: str
    end_timestamp: int
    end_time: str
    end_time_12hr: str
    start_date: str
    end_date: str
    room: str
    instructor: str
    session_type: str
    description: str


class Section(BaseModel):
    """Represents a course section with all its components."""
    
    course_id: int
    id: str
    label: str
    instructor: str
    description: str
    num_components: int
    components: Dict[str, Component]
    
    def get_components_by_type(self, component_type: str) -> list[Component]:
        """Get all components of a specific type (e.g., 'LEC', 'LAB', 'TUT')."""
        return [
            comp for comp in self.components.values()
            if comp.type == component_type
        ]
    
    def get_all_instructors(self) -> set[str]:
        """Get all unique instructors for this section."""
        instructors = {self.instructor}
        for component in self.components.values():
            if component.instructor:
                instructors.add(component.instructor)
        return instructors


class SectionData(BaseModel):
    """Represents all sections for a course."""
    
    sections: Dict[str, Section] = Field(default_factory=dict)
    
    def get_section(self, section_id: str) -> Optional[Section]:
        """Get a specific section by its ID."""
        return self.sections.get(section_id)
    
    def get_all_sections(self) -> list[Section]:
        """Get all sections as a list."""
        return list(self.sections.values())
    
    def get_open_sections(self) -> list[Section]:
        """Get all sections that have at least one open component."""
        return [
            section for section in self.sections.values()
            if any(comp.status == "OPEN" for comp in section.components.values())
        ]
