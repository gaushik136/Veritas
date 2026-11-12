"""Safe URL article extraction with SSRF protection and robust HTML parsing."""
from __future__ import annotations
import ipaddress
import re
import socket
from dataclasses import dataclass, field
from urllib.parse import urlparse

MAX_RESPONSE_BYTES = 1024 * 1024  # 1MB
REQUEST_TIMEOUT = 12  # seconds


class URLExtractionError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 422):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


@dataclass
class ExtractionResult:
    status: str
    original_url: str
    text: str
    canonical_url: str | None = None
    title: str | None = None
    publisher: str | None = None
    language: str | None = None
    warnings: list[str] = field(default_factory=list)


_PRIVATE_RANGES = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def _is_private_ip(hostname: str) -> bool:
    """Block SSRF by checking if hostname resolves to a private or reserved IP."""
    try:
        addrs = socket.getaddrinfo(hostname, None)
        for addr in addrs:
            ip_str = addr[4][0]
            ip = ipaddress.ip_address(ip_str)
            if ip.is_loopback or ip.is_private or ip.is_link_local:
                return True
            for net in _PRIVATE_RANGES:
                if ip in net:
                    return True
    except Exception:
        return True  # Fail safe
    return False


def _validate_url(url: str) -> str:
    """Validate URL scheme and check for SSRF risk."""
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url  # Convenience auto-prefix
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise URLExtractionError("invalid_scheme", "Only http and https URLs are supported.", 422)
    hostname = parsed.hostname
    if not hostname:
        raise URLExtractionError("invalid_url", "URL must include a valid hostname.", 422)
    if _is_private_ip(hostname):
        raise URLExtractionError("blocked_host", "Cannot fetch from internal, private, or loopback network addresses.", 403)
    return url


def extract_article(url: str) -> ExtractionResult:
    """Fetch and extract clean readable text from a public news or reference URL."""
    import requests
    from bs4 import BeautifulSoup

    validated_url = _validate_url(url)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Ch-Ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Upgrade-Insecure-Requests": "1",
    }

    try:
        session = requests.Session()
        resp = session.get(
            validated_url,
            headers=headers,
            timeout=REQUEST_TIMEOUT,
            stream=True,
            allow_redirects=True,
        )
    except requests.exceptions.ConnectionError:
        raise URLExtractionError("connection_failed", "Could not connect to the specified URL. Please check the domain.", 422)
    except requests.exceptions.Timeout:
        raise URLExtractionError("timeout", "The website took too long to respond (timeout).", 422)
    except Exception as exc:
        raise URLExtractionError("fetch_failed", f"Failed to fetch URL: {str(exc)[:100]}", 422)

    if resp.status_code == 404:
        raise URLExtractionError("not_found", "The article or page was not found (HTTP 404).", 422)
    if resp.status_code == 403:
        raise URLExtractionError("forbidden", "Access to this website is restricted or protected by anti-bot measures (HTTP 403).", 422)
    if resp.status_code >= 400:
        raise URLExtractionError("http_error", f"The server returned an HTTP {resp.status_code} error.", 422)

    content_type = resp.headers.get("content-type", "")
    if "html" not in content_type.lower() and "text" not in content_type.lower():
        raise URLExtractionError("not_html", "The URL does not point to an HTML webpage.", 422)

    # Read limited stream content
    chunks = []
    total = 0
    for chunk in resp.iter_content(chunk_size=16384):
        chunks.append(chunk)
        total += len(chunk)
        if total > MAX_RESPONSE_BYTES:
            break
    raw_html = b"".join(chunks)

    encoding = resp.encoding or "utf-8"
    try:
        html = raw_html.decode(encoding, errors="replace")
    except Exception:
        html = raw_html.decode("utf-8", errors="replace")

    soup = BeautifulSoup(html, "html.parser")

    # Decompose irrelevant non-article elements
    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "form", "button", "iframe", "svg"]):
        tag.decompose()

    # Extract Title
    title = None
    og_title = soup.find("meta", property="og:title") or soup.find("meta", attrs={"name": "twitter:title"})
    if og_title and og_title.get("content"):
        title = og_title["content"].strip()
    elif soup.title and soup.title.string:
        title = soup.title.string.strip()

    # Extract Publisher / Site Name
    publisher = None
    og_site = soup.find("meta", property="og:site_name") or soup.find("meta", attrs={"name": "application-name"})
    if og_site and og_site.get("content"):
        publisher = og_site["content"].strip()
    else:
        publisher = urlparse(validated_url).hostname

    # Extract Canonical URL
    canonical_url = None
    canonical = soup.find("link", rel="canonical")
    if canonical and canonical.get("href"):
        canonical_url = canonical["href"].strip()

    # Extract Content: Strategy 1 - Semantic tags
    text = ""
    for selector in ["article", "[role='main']", "main", ".article-body", "#article-body", ".post-content", ".entry-content", ".story-content", "#mw-content-text"]:
        element = soup.select_one(selector)
        if element:
            # Collect paragraphs inside the container
            paras = [p.get_text(" ", strip=True) for p in element.find_all(["p", "h2", "h3"])]
            paras = [p for p in paras if len(p) > 20]
            if len(" ".join(paras)) > 150:
                text = "\n\n".join(paras)
                break

    # Strategy 2 - Direct body paragraph scan
    if not text or len(text) < 100:
        paras = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
        paras = [p for p in paras if len(p) > 25]
        if paras:
            text = "\n\n".join(paras)

    # Strategy 3 - Fallback body text
    if not text or len(text) < 100:
        body = soup.find("body")
        text = body.get_text("\n", strip=True) if body else ""

    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text[:8000].strip()

    if len(text) < 50:
        raise URLExtractionError("no_content", "Could not extract readable article text from this URL. Try copying and pasting the text directly.", 422)

    return ExtractionResult(
        status="success",
        original_url=url,
        canonical_url=canonical_url or validated_url,
        title=title,
        publisher=publisher,
        text=text,
        language="en",
        warnings=[]
    )
