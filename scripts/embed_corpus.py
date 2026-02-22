#!/usr/bin/env python3
import os
import json
import time
from pathlib import Path
from openai import OpenAI

CORPUS_DIR = Path(__file__).resolve().parents[1] / "corpus"
CHUNKS_PATH = CORPUS_DIR / "chunks.jsonl"
OUT_PATH = CORPUS_DIR / "embeddings.jsonl"

MODEL = "text-embedding-3-small"
BATCH_SIZE = 100


def main():
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    items = []
    with CHUNKS_PATH.open("r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                items.append(json.loads(line))

    total = len(items)
    print(f"Embedding {total} chunks...")

    with OUT_PATH.open("w", encoding="utf-8") as out:
        for i in range(0, total, BATCH_SIZE):
            batch = items[i : i + BATCH_SIZE]
            texts = [b["text"] for b in batch]
            resp = client.embeddings.create(model=MODEL, input=texts)
            for b, e in zip(batch, resp.data):
                record = {**b, "embedding": e.embedding}
                out.write(json.dumps(record, ensure_ascii=False) + "\n")
            print(f"Processed {min(i + BATCH_SIZE, total)}/{total}")
            time.sleep(0.2)

    print(f"Saved embeddings to {OUT_PATH}")


if __name__ == "__main__":
    main()
