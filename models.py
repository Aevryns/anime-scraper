from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional
import json

@dataclass
class AnimeItem:
    title: str
    slug: str
    url: str
    letter: str

    def to_dict(self) -> dict:
        return asdict(self)

@dataclass
class AnimeDetail:
    title: str
    alt_title: str
    slug: str
    url: str
    image_url: str
    genres: List[str] = field(default_factory=list)
    synopsis: str = ""
    episodes_count: int = 0
    episodes: List[Dict[str, str]] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)

@dataclass
class MovieItem:
    title: str
    slug: str
    url: str
    image_url: str
    labels: List[str] = field(default_factory=list)
    description: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

@dataclass
class GenreItem:
    name: str
    slug: str
    url: str

    def to_dict(self) -> dict:
        return asdict(self)

@dataclass
class UpdateItem:
    title: str
    episode: str
    url: str
    image_url: str

    def to_dict(self) -> dict:
        return asdict(self)

@dataclass
class EpisodeStream:
    episode_title: str
    episode_url: str
    main_video: Optional[str] = None
    servers: List[Dict[str, str]] = field(default_factory=list)
    downloads: List[Dict[str, str]] = field(default_factory=list)
    parent_anime_url: Optional[str] = None
    prev_url: Optional[str] = None
    next_url: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)
