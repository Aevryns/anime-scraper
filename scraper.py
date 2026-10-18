import asyncio
import ssl
import time
import urllib.parse
from typing import List, Dict, Any, Optional, Set, Callable
import requests
from bs4 import BeautifulSoup
import certifi
import aiohttp

from models import AnimeItem, AnimeDetail, MovieItem, GenreItem, UpdateItem, EpisodeStream
from validator import (
    normalize_url,
    validate_anime_item,
    validate_anime_detail,
    validate_movie_item,
    validate_genre_item,
    validate_update_item,
    BASE_URL,
)
from storage import Storage

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
}

class AnimeIndoScraper:
    def __init__(self, base_url: str = BASE_URL, storage: Optional[Storage] = None):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self.storage = storage or Storage()

    def fetch_soup(self, url: str) -> BeautifulSoup:
        resp = self.session.get(url, timeout=20)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "html.parser")

    def get_anime_list(self) -> List[AnimeItem]:
        url = f"{self.base_url}/anime-list/"
        soup = self.fetch_soup(url)

        valid_items: List[AnimeItem] = []
        seen_slugs: Set[str] = set()
        current_letter = ""

        container = soup.find("div", class_="ngirix") or soup.find("div", class_="ngiri") or soup

        for elem in container.find_all(["div", "li"]):
            if elem.name == "div" and "letter" in elem.get("class", []):
                current_letter = elem.text.strip()
            elif elem.name == "li":
                a = elem.find("a")
                if not a or not a.get("href"):
                    continue

                raw_href = a.get("href", "").strip()
                title = a.text.strip()
                if not title or not raw_href:
                    continue

                full_url = normalize_url(raw_href, self.base_url)
                slug = raw_href.strip("/").split("/")[-1]
                if not slug:
                    continue

                item = AnimeItem(
                    title=title,
                    slug=slug,
                    url=full_url,
                    letter=current_letter
                )

                is_valid, _ = validate_anime_item(item)
                if is_valid and slug not in seen_slugs:
                    seen_slugs.add(slug)
                    valid_items.append(item)

        return valid_items

    def get_genres(self) -> List[GenreItem]:
        url = f"{self.base_url}/list-genre/"
        soup = self.fetch_soup(url)

        genres: List[GenreItem] = []
        seen_slugs: Set[str] = set()

        for a in soup.find_all("a"):
            href = a.get("href", "")
            if "/genres/" in href:
                name = a.text.strip()
                if not name:
                    continue
                full_url = normalize_url(href, self.base_url)
                slug = href.strip("/").split("/")[-1]
                if slug and slug not in seen_slugs:
                    seen_slugs.add(slug)
                    item = GenreItem(name=name, slug=slug, url=full_url)
                    is_valid, _ = validate_genre_item(item)
                    if is_valid:
                        genres.append(item)

        genres.sort(key=lambda x: x.name)
        return genres

    def get_total_movie_pages(self) -> int:
        url = f"{self.base_url}/movie/"
        soup = self.fetch_soup(url)
        pag = soup.find("div", class_="pag")
        last_page = 1
        if pag:
            for a in pag.find_all("a"):
                href = a.get("href", "")
                if "/page/" in href:
                    part = href.strip("/").split("/")[-1]
                    if part.isdigit():
                        last_page = max(last_page, int(part))
        return last_page

    def get_movies_from_page(self, page_num: int) -> List[MovieItem]:
        url = f"{self.base_url}/movie/page/{page_num}/" if page_num > 1 else f"{self.base_url}/movie/"
        try:
            soup = self.fetch_soup(url)
        except Exception:
            return []

        movies: List[MovieItem] = []
        tables = soup.find_all("table", class_="otable")
        for table in tables:
            videsc = table.find("td", class_="videsc")
            vithumb = table.find("td", class_="vithumb")
            if not videsc:
                continue

            a_title = videsc.find("a")
            if not a_title:
                continue

            title = a_title.text.strip()
            href = a_title.get("href", "")
            full_url = normalize_url(href, self.base_url)
            slug = href.strip("/").split("/")[-1]

            img_el = vithumb.find("img") if vithumb else None
            img_url = ""
            if img_el:
                img_url = img_el.get("data-original") or img_el.get("src") or ""
                img_url = normalize_url(img_url, self.base_url)

            labels = [span.text.strip() for span in videsc.find_all("span", class_="label")]
            p_des = videsc.find("p", class_="des")
            description = p_des.text.strip() if p_des else ""

            item = MovieItem(
                title=title,
                slug=slug,
                url=full_url,
                image_url=img_url,
                labels=labels,
                description=description
            )
            is_valid, _ = validate_movie_item(item)
            if is_valid:
                movies.append(item)

        return movies

    def get_all_movies(self, max_pages: Optional[int] = None, on_progress: Optional[Callable[[int, int], None]] = None) -> List[MovieItem]:
        total_pages = self.get_total_movie_pages()
        if max_pages:
            total_pages = min(total_pages, max_pages)

        all_movies: List[MovieItem] = []
        seen_slugs: Set[str] = set()

        for page in range(1, total_pages + 1):
            page_movies = self.get_movies_from_page(page)
            for m in page_movies:
                if m.slug not in seen_slugs:
                    seen_slugs.add(m.slug)
                    all_movies.append(m)
            if on_progress:
                on_progress(page, total_pages)

        return all_movies

    def get_latest_updates(self, max_pages: int = 10) -> List[UpdateItem]:
        updates: List[UpdateItem] = []
        for p in range(1, max_pages + 1):
            url = f"{self.base_url}/page/{p}/" if p > 1 else f"{self.base_url}/"
            try:
                soup = self.fetch_soup(url)
            except Exception:
                continue

            items = soup.find_all("div", class_="list-anime")
            for div in items:
                parent_a = div.parent if div.parent and div.parent.name == "a" else div.find("a")
                href = parent_a.get("href", "") if parent_a else ""
                full_url = normalize_url(href, self.base_url)

                p_el = div.find("p")
                title = p_el.text.strip() if p_el else ""

                span_el = div.find("span", class_="eps")
                episode = span_el.text.strip() if span_el else ""

                img_el = div.find("img")
                img_url = ""
                if img_el:
                    img_url = img_el.get("data-original") or img_el.get("src") or ""
                    img_url = normalize_url(img_url, self.base_url)

                item = UpdateItem(title=title, episode=episode, url=full_url, image_url=img_url)
                is_valid, _ = validate_update_item(item)
                if is_valid:
                    updates.append(item)

        return updates

    def get_anime_detail(self, url_or_slug: str) -> Optional[AnimeDetail]:
        if url_or_slug.startswith("http"):
            url = url_or_slug
            slug = url.strip("/").split("/")[-1]
        else:
            slug = url_or_slug.strip("/")
            url = f"{self.base_url}/anime/{slug}/"

        try:
            soup = self.fetch_soup(url)
        except Exception:
            return None

        return self._parse_anime_detail_soup(soup, slug, url)

    def _parse_anime_detail_soup(self, soup: BeautifulSoup, slug: str, url: str) -> Optional[AnimeDetail]:
        title_el = soup.find("h1", class_="title")
        title = title_el.text.strip() if title_el else ""
        if not title:
            return None

        detail_div = soup.find("div", class_="detail")
        alt_title = ""
        image_url = ""
        genres = []
        synopsis = ""

        if detail_div:
            img_el = detail_div.find("img")
            if img_el:
                raw_img = img_el.get("data-original") or img_el.get("src") or ""
                image_url = normalize_url(raw_img, self.base_url)

            h2_el = detail_div.find("h2")
            alt_title = h2_el.text.strip() if h2_el else ""

            genres = [a.text.strip() for a in detail_div.find_all("a", rel="tag")]

            p_el = detail_div.find("p")
            synopsis = p_el.text.strip() if p_el else ""

        episodes = []
        ep_div = soup.find("div", class_="ep")
        if ep_div:
            for a in ep_div.find_all("a"):
                ep_text = a.text.strip()
                ep_href = a.get("href", "")
                if ep_href:
                    episodes.append({
                        "episode": ep_text,
                        "url": normalize_url(ep_href, self.base_url)
                    })

        detail = AnimeDetail(
            title=title,
            alt_title=alt_title,
            slug=slug,
            url=url,
            image_url=image_url,
            genres=genres,
            synopsis=synopsis,
            episodes_count=len(episodes),
            episodes=episodes
        )

        is_valid, _ = validate_anime_detail(detail)
        return detail if is_valid else None

    async def crawl_anime_details_async(
        self,
        anime_items: List[AnimeItem],
        concurrency: int = 15,
        batch_size: int = 50,
        on_batch_done: Optional[Callable[[int, int, List[AnimeDetail]], None]] = None
    ) -> List[AnimeDetail]:
        ssl_ctx = ssl.create_default_context(cafile=certifi.where())
        conn = aiohttp.TCPConnector(ssl=ssl_ctx, limit=concurrency + 5)
        headers = DEFAULT_HEADERS.copy()

        crawled_slugs = self.storage.get_crawled_detail_slugs()
        pending_items = [it for it in anime_items if it.slug not in crawled_slugs]

        sem = asyncio.Semaphore(concurrency)
        all_results: List[AnimeDetail] = []
        total = len(pending_items)
        completed = 0

        async def fetch_one(session: aiohttp.ClientSession, item: AnimeItem) -> Optional[AnimeDetail]:
            async with sem:
                for attempt in range(3):
                    try:
                        async with session.get(item.url, timeout=aiohttp.ClientTimeout(total=20)) as resp:
                            if resp.status == 200:
                                html = await resp.text()
                                soup = BeautifulSoup(html, "html.parser")
                                return self._parse_anime_detail_soup(soup, item.slug, item.url)
                            elif resp.status == 404:
                                return None
                    except Exception:
                        await asyncio.sleep(1 + attempt)
                return None

        async with aiohttp.ClientSession(connector=conn, headers=headers) as session:
            for i in range(0, total, batch_size):
                chunk = pending_items[i:i + batch_size]
                tasks = [fetch_one(session, it) for it in chunk]
                batch_res = await asyncio.gather(*tasks)
                valid_batch = [d for d in batch_res if d is not None]

                if valid_batch:
                    self.storage.save_anime_details_batch(valid_batch)
                    all_results.extend(valid_batch)

                completed += len(chunk)
                if on_batch_done:
                    on_batch_done(completed, total, valid_batch)

        return all_results

    def get_episode_stream(self, url_or_slug: str) -> Optional[EpisodeStream]:
        if url_or_slug.startswith("http"):
            url = url_or_slug
        else:
            cleaned = url_or_slug.strip("/")
            url = f"{self.base_url}/{cleaned}/"

        try:
            soup = self.fetch_soup(url)
        except Exception:
            return None

        title_el = soup.find("h1", class_="title")
        title = title_el.text.strip() if title_el else ""

        iframe = soup.find("iframe", id="tontonin")
        main_video = iframe.get("src") if iframe else None

        servers = []
        server_div = soup.find("div", class_="servers")
        if server_div:
            for a in server_div.find_all("a"):
                servers.append({
                    "name": a.text.strip(),
                    "video_url": a.get("data-video", "")
                })

        downloads = []
        nav_div = soup.find("div", class_="nav")
        prev_url = None
        next_url = None
        parent_url = None

        if nav_div:
            for a in nav_div.find_all("a"):
                text = a.text.strip()
                href = a.get("href", "")
                if "Download" in text:
                    downloads.append({"name": text, "url": href})
                elif "Prev" in text:
                    prev_url = normalize_url(href, self.base_url)
                elif "Next" in text:
                    next_url = normalize_url(href, self.base_url)
                elif "Semua Episode" in text or "/anime/" in href:
                    parent_url = normalize_url(href, self.base_url)

        return EpisodeStream(
            episode_title=title,
            episode_url=url,
            main_video=main_video,
            servers=servers,
            downloads=downloads,
            parent_anime_url=parent_url,
            prev_url=prev_url,
            next_url=next_url
        )

    def search(self, query: str) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/search.php?q={urllib.parse.quote(query)}"
        soup = self.fetch_soup(url)

        results = []
        tables = soup.find_all("table", class_="otable")
        for table in tables:
            videsc = table.find("td", class_="videsc")
            vithumb = table.find("td", class_="vithumb")
            if not videsc:
                continue

            a_title = videsc.find("a")
            if not a_title:
                continue

            title = a_title.text.strip()
            href = a_title.get("href", "")
            slug = href.strip("/").split("/")[-1]
            full_url = normalize_url(href, self.base_url)

            img_el = vithumb.find("img") if vithumb else None
            img_url = ""
            if img_el:
                raw_img = img_el.get("data-original") or img_el.get("src") or ""
                img_url = normalize_url(raw_img, self.base_url)

            labels = [s.text.strip() for s in videsc.find_all("span", class_="label")]
            p_des = videsc.find("p", class_="des")
            description = p_des.text.strip() if p_des else ""

            results.append({
                "title": title,
                "slug": slug,
                "url": full_url,
                "image_url": img_url,
                "labels": labels,
                "description": description
            })

        return results
