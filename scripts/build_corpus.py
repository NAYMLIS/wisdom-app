#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path

RAW_DIR = Path(__file__).resolve().parents[1] / "corpus" / "raw"
OUT_PATH = Path(__file__).resolve().parents[1] / "corpus" / "chunks.jsonl"

MAX_WORDS = 900
MIN_WORDS = 400


def strip_gutenberg(text: str) -> str:
    start = re.search(r"\*\*\* START OF THE PROJECT GUTENBERG EBOOK .*?\*\*\*", text)
    end = re.search(r"\*\*\* END OF THE PROJECT GUTENBERG EBOOK .*?\*\*\*", text)
    if start and end:
        return text[start.end():end.start()]
    return text


def word_count(s: str) -> int:
    return len(re.findall(r"\w+", s))


def flush_chunk(chunks, meta, buf, verse_start=None, verse_end=None):
    text = " ".join(buf).strip()
    if not text:
        return
    chunk = {
        "id": meta["id"],
        "text": text,
        "tradition": meta["tradition"],
        "source": meta["source"],
        "book": meta.get("book"),
        "chapter": meta.get("chapter"),
        "verse": meta.get("verse"),
    }
    if verse_start is not None:
        chunk["verse"] = f"{verse_start}-{verse_end}" if verse_end and verse_end != verse_start else str(verse_start)
    chunks.append(chunk)


BOOK_HEADING_PATTERNS = [
    (re.compile(r"^The First Book of Moses: Called (.+)$"), lambda m: m.group(1)),
    (re.compile(r"^The Second Book of Moses: Called (.+)$"), lambda m: m.group(1)),
    (re.compile(r"^The Third Book of Moses: Called (.+)$"), lambda m: m.group(1)),
    (re.compile(r"^The Fourth Book of Moses: Called (.+)$"), lambda m: m.group(1)),
    (re.compile(r"^The Fifth Book of Moses: Called (.+)$"), lambda m: m.group(1)),
    (re.compile(r"^The Book of (.+)$"), lambda m: m.group(1)),
    (re.compile(r"^The Gospel According to Saint (.+)$"), lambda m: m.group(1)),
    (re.compile(r"^The Acts of the Apostles$"), lambda m: "Acts"),
    (re.compile(r"^The Epistle of Paul the Apostle to the (.+)$"), lambda m: m.group(1)),
    (re.compile(r"^The First Epistle of Paul the Apostle to the (.+)$"), lambda m: "1 " + m.group(1)),
    (re.compile(r"^The Second Epistle of Paul the Apostle to the (.+)$"), lambda m: "2 " + m.group(1)),
    (re.compile(r"^The General Epistle of (.+)$"), lambda m: m.group(1)),
    (re.compile(r"^The First Epistle General of (.+)$"), lambda m: "1 " + m.group(1)),
    (re.compile(r"^The Second General Epistle of (.+)$"), lambda m: "2 " + m.group(1)),
    (re.compile(r"^The Third Epistle General of (.+)$"), lambda m: "3 " + m.group(1)),
    (re.compile(r"^The Revelation of Saint John the Divine$"), lambda m: "Revelation"),
]


def parse_bible(path: Path):
    text = strip_gutenberg(path.read_text(encoding="utf-8", errors="ignore"))
    lines = [l.strip() for l in text.splitlines()]
    chunks = []
    book = None
    chapter = None
    buf = []
    verse_start = None
    verse_end = None

    def commit():
        nonlocal buf, verse_start, verse_end
        if not buf:
            return
        meta = {
            "id": f"bible-{slug(book)}-{chapter}-{verse_start}",
            "tradition": "christianity",
            "source": "Bible (KJV)",
            "book": book,
            "chapter": chapter,
            "verse": None,
        }
        flush_chunk(chunks, meta, buf, verse_start, verse_end)
        buf = []
        verse_start = None
        verse_end = None

    for line in lines:
        if not line:
            continue
        # Book heading
        for pat, fn in BOOK_HEADING_PATTERNS:
            m = pat.match(line)
            if m:
                book = fn(m)
                chapter = None
                buf = []
                verse_start = None
                verse_end = None
                break
        else:
            m = re.match(r"^(\d+):(\d+)\s+(.+)$", line)
            if m:
                c = int(m.group(1))
                v = int(m.group(2))
                verse_text = f"{m.group(1)}:{m.group(2)} {m.group(3)}"
                if chapter != c:
                    commit()
                    chapter = c
                if verse_start is None:
                    verse_start = v
                if word_count(" ".join(buf + [verse_text])) > MAX_WORDS and word_count(" ".join(buf)) >= MIN_WORDS:
                    commit()
                    verse_start = v
                buf.append(verse_text)
                verse_end = v
            # ignore other lines
    commit()
    return chunks


def parse_numbered_chapters(path: Path, source, tradition, id_prefix, chapter_regex, verse_regex=None, book_name=None):
    text = strip_gutenberg(path.read_text(encoding="utf-8", errors="ignore"))
    lines = [l.rstrip() for l in text.splitlines()]
    chunks = []
    chapter = None
    buf = []
    verse_start = None
    verse_end = None

    def commit():
        nonlocal buf, verse_start, verse_end
        if not buf:
            return
        meta = {
            "id": f"{id_prefix}-{chapter}-{verse_start or 1}",
            "tradition": tradition,
            "source": source,
            "book": book_name or source,
            "chapter": chapter,
            "verse": None,
        }
        flush_chunk(chunks, meta, buf, verse_start, verse_end)
        buf = []
        verse_start = None
        verse_end = None

    for line in lines:
        line = line.strip()
        if not line:
            continue
        m = chapter_regex.match(line)
        if m:
            commit()
            chapter = roman_to_int(m.group(1))
            continue
        if verse_regex:
            vm = verse_regex.match(line)
            if vm:
                v = int(vm.group(1))
                verse_text = line
                if verse_start is None:
                    verse_start = v
                if word_count(" ".join(buf + [verse_text])) > MAX_WORDS and word_count(" ".join(buf)) >= MIN_WORDS:
                    commit()
                    verse_start = v
                buf.append(verse_text)
                verse_end = v
                continue
        # fallback line
        if word_count(" ".join(buf + [line])) > MAX_WORDS and word_count(" ".join(buf)) >= MIN_WORDS:
            commit()
        buf.append(line)

    commit()
    return chunks


def parse_tao(path: Path):
    text = strip_gutenberg(path.read_text(encoding="utf-8", errors="ignore"))
    lines = [l.strip() for l in text.splitlines()]
    chunks = []
    chapter = None
    buf = []

    def commit():
        nonlocal buf
        if not buf or chapter is None:
            return
        meta = {
            "id": f"tao-te-ching-{chapter}",
            "tradition": "taoism",
            "source": "Tao Te Ching",
            "book": "Tao Te Ching",
            "chapter": chapter,
            "verse": None,
        }
        flush_chunk(chunks, meta, buf)
        buf = []

    for line in lines:
        if not line:
            continue
        if re.match(r"^\d+$", line):
            commit()
            chapter = int(line)
            continue
        if chapter is not None:
            buf.append(line)
    commit()
    return chunks


def parse_letters(path: Path):
    text = strip_gutenberg(path.read_text(encoding="utf-8", errors="ignore"))
    lines = [l.strip() for l in text.splitlines()]
    chunks = []
    letter = None
    buf = []

    def commit():
        nonlocal buf
        if not buf or letter is None:
            return
        meta = {
            "id": f"letters-stoic-{letter}",
            "tradition": "stoicism",
            "source": "Letters from a Stoic (Seneca)",
            "book": "Letters from a Stoic",
            "chapter": letter,
            "verse": None,
        }
        flush_chunk(chunks, meta, buf)
        buf = []

    for line in lines:
        if not line:
            continue
        m = re.match(r"^LETTER\s+([IVXLC]+|\d+)$", line, re.IGNORECASE)
        if m:
            commit()
            letter = roman_to_int(m.group(1))
            continue
        if letter is not None:
            if word_count(" ".join(buf + [line])) > MAX_WORDS and word_count(" ".join(buf)) >= MIN_WORDS:
                commit()
            buf.append(line)
    commit()
    return chunks


def parse_meditations(path: Path):
    text = strip_gutenberg(path.read_text(encoding="utf-8", errors="ignore"))
    lines = [l.strip() for l in text.splitlines()]
    chunks = []
    book = None
    buf = []

    def commit():
        nonlocal buf
        if not buf or book is None:
            return
        meta = {
            "id": f"meditations-book-{book}",
            "tradition": "stoicism",
            "source": "Meditations (Marcus Aurelius)",
            "book": "Meditations",
            "chapter": book,
            "verse": None,
        }
        flush_chunk(chunks, meta, buf)
        buf = []

    for line in lines:
        if not line:
            continue
        m = re.match(r"^BOOK\s+([IVXLC]+|\d+)$", line, re.IGNORECASE)
        if m:
            commit()
            book = roman_to_int(m.group(1))
            continue
        if book is not None:
            if word_count(" ".join(buf + [line])) > MAX_WORDS and word_count(" ".join(buf)) >= MIN_WORDS:
                commit()
            buf.append(line)
    commit()
    return chunks


def parse_enchiridion(path: Path):
    text = strip_gutenberg(path.read_text(encoding="utf-8", errors="ignore"))
    lines = [l.strip() for l in text.splitlines()]
    chunks = []
    section = None
    buf = []

    def commit():
        nonlocal buf
        if not buf or section is None:
            return
        meta = {
            "id": f"enchiridion-{section}",
            "tradition": "stoicism",
            "source": "Enchiridion (Epictetus)",
            "book": "Enchiridion",
            "chapter": section,
            "verse": None,
        }
        flush_chunk(chunks, meta, buf)
        buf = []

    for line in lines:
        if not line:
            continue
        m = re.match(r"^(\d+)\.\s*(.*)$", line)
        if m:
            commit()
            section = int(m.group(1))
            if m.group(2):
                buf.append(line)
            continue
        if section is not None:
            if word_count(" ".join(buf + [line])) > MAX_WORDS and word_count(" ".join(buf)) >= MIN_WORDS:
                commit()
            buf.append(line)
    commit()
    return chunks


def parse_yoga(path: Path):
    text = strip_gutenberg(path.read_text(encoding="utf-8", errors="ignore"))
    lines = [l.strip() for l in text.splitlines()]
    chunks = []
    book = None
    buf = []
    verse_start = None
    verse_end = None

    def commit():
        nonlocal buf, verse_start, verse_end
        if not buf or book is None:
            return
        meta = {
            "id": f"yoga-sutras-{book}-{verse_start or 1}",
            "tradition": "hinduism",
            "source": "Yoga Sutras of Patanjali",
            "book": "Yoga Sutras",
            "chapter": book,
            "verse": None,
        }
        flush_chunk(chunks, meta, buf, verse_start, verse_end)
        buf = []
        verse_start = None
        verse_end = None

    for line in lines:
        if not line:
            continue
        m = re.match(r"^BOOK\s+([IVXLC]+|\d+)$", line, re.IGNORECASE)
        if m:
            commit()
            book = roman_to_int(m.group(1))
            continue
        vm = re.match(r"^(\d+)\.\s+(.+)$", line)
        if vm:
            v = int(vm.group(1))
            if verse_start is None:
                verse_start = v
            verse_end = v
            if word_count(" ".join(buf + [line])) > MAX_WORDS and word_count(" ".join(buf)) >= MIN_WORDS:
                commit()
                verse_start = v
            buf.append(line)
            continue
        if book is not None:
            buf.append(line)
    commit()
    return chunks


def parse_generic(path: Path, source, tradition, id_prefix):
    text = strip_gutenberg(path.read_text(encoding="utf-8", errors="ignore"))
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = min(len(words), start + MAX_WORDS)
        text_chunk = " ".join(words[start:end])
        meta = {
            "id": f"{id_prefix}-{start}",
            "tradition": tradition,
            "source": source,
            "book": source,
            "chapter": None,
            "verse": None,
        }
        chunks.append({**meta, "text": text_chunk})
        start = end
    return chunks


def roman_to_int(s):
    s = s.upper()
    if s.isdigit():
        return int(s)
    roman = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
    total = 0
    prev = 0
    for ch in reversed(s):
        val = roman.get(ch, 0)
        if val < prev:
            total -= val
        else:
            total += val
            prev = val
    return total or None


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") if s else "unknown"


def main():
    corpus = []
    corpus += parse_bible(RAW_DIR / "bible-kjv.txt")
    corpus += parse_numbered_chapters(
        RAW_DIR / "quran-yusuf-ali.txt",
        source="Quran (Yusuf Ali)",
        tradition="islam",
        id_prefix="quran",
        chapter_regex=re.compile(r"^CHAPTER\s+(\d+)\b", re.IGNORECASE),
        verse_regex=re.compile(r"^(\d+)\.\s+.*"),
        book_name="Quran",
    )
    corpus += parse_numbered_chapters(
        RAW_DIR / "bhagavad-gita.txt",
        source="Bhagavad Gita",
        tradition="hinduism",
        id_prefix="bhagavad-gita",
        chapter_regex=re.compile(r"^CHAPTER\s+([IVXLC]+|\d+)\b", re.IGNORECASE),
        verse_regex=re.compile(r"^(\d+)\.\s+.*"),
        book_name="Bhagavad Gita",
    )
    corpus += parse_tao(RAW_DIR / "tao-te-ching.txt")
    corpus += parse_numbered_chapters(
        RAW_DIR / "dhammapada.txt",
        source="Dhammapada",
        tradition="buddhism",
        id_prefix="dhammapada",
        chapter_regex=re.compile(r"^CHAPTER\s+([IVXLC]+|\d+)\b", re.IGNORECASE),
        verse_regex=re.compile(r"^(\d+)\.\s+.*"),
        book_name="Dhammapada",
    )
    corpus += parse_meditations(RAW_DIR / "meditations.txt")
    corpus += parse_letters(RAW_DIR / "letters-stoic.txt")
    corpus += parse_enchiridion(RAW_DIR / "enchiridion.txt")
    corpus += parse_yoga(RAW_DIR / "yoga-sutras.txt")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        for item in corpus:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    print(f"Wrote {len(corpus)} chunks to {OUT_PATH}")


if __name__ == "__main__":
    main()
