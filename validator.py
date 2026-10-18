from typing import Tuple, Optional
import urllib.parse
from models import AnimeItem, AnimeDetail, MovieItem, GenreItem, UpdateItem

BASE_URL = "https://anime-indo.lol"

def normalize_url(url: str, base: str = BASE_URL) -> str:
    if not url:
        return ""
    url = url.strip()
    if url.startswith("//"):
        return f"https:{url}"
    elif url.startswith("/"):
        return urllib.parse.urljoin(base, url)
    elif not url.startswith("http://") and not url.startswith("https://"):
        return urllib.parse.urljoin(base, "/" + url)
    return url

def validate_anime_item(item: AnimeItem) -> Tuple[bool, Optional[str]]:
    if not item.title or not item.title.strip():
        return False, "Title is empty"
    if not item.slug or not item.slug.strip():
        return False, "Slug is empty"
    if not item.url or not item.url.startswith(BASE_URL):
        return False, f"Invalid URL: {item.url}"
    return True, None

def validate_anime_detail(detail: AnimeDetail) -> Tuple[bool, Optional[str]]:
    if not detail.title or not detail.title.strip():
        return False, "Title is empty"
    if not detail.slug or not detail.slug.strip():
        return False, "Slug is empty"
    if not detail.url or not detail.url.startswith(BASE_URL):
        return False, f"Invalid URL: {detail.url}"
    if detail.episodes_count < 0:
        return False, "Episode count cannot be negative"
    return True, None

def validate_movie_item(item: MovieItem) -> Tuple[bool, Optional[str]]:
    if not item.title or not item.title.strip():
        return False, "Title is empty"
    if not item.slug or not item.slug.strip():
        return False, "Slug is empty"
    if not item.url or not item.url.startswith(BASE_URL):
        return False, f"Invalid URL: {item.url}"
    return True, None

def validate_genre_item(item: GenreItem) -> Tuple[bool, Optional[str]]:
    if not item.name or not item.name.strip():
        return False, "Genre name is empty"
    if not item.url or not item.url.startswith(BASE_URL):
        return False, f"Invalid URL: {item.url}"
    return True, None

def validate_update_item(item: UpdateItem) -> Tuple[bool, Optional[str]]:
    if not item.title or not item.title.strip():
        return False, "Update title is empty"
    if not item.url or not item.url.startswith(BASE_URL):
        return False, f"Invalid URL: {item.url}"
    return True, None
