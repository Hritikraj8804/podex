import re

def normalize_action_plan(text: str) -> str:
    """
    Normalizes an AI-generated action plan into a clean line-per-step
    numbered list so the frontend can render it reliably.

    Handles these messy formats:
      - "1. Do X 2. Do Y 3. Do Z"      (inline steps on one line)
      - "1\\nGet the current YAML..."   (bare number on its own line)
      - "1) Do X 2) Do Y"              (parenthesized numbers)
    """
    if not text:
        return text

    text = text.strip()

    # 1) Bare number on its own line joins the following text:
    #    "1\nGet the current YAML..." -> "1. Get the current YAML..."
    text = re.sub(r'(?m)^\s*(\d+)[.)]?\s*\n(?=\s*\S)', r'\1. ', text)

    # 2) Split inline steps sharing one line: "1. A 2. B 3. C" -> three lines.
    parts = re.split(r'(?<=\S)\s+(?=\d+[.)]\s)', text)
    lines = [p.strip() for p in parts if p and p.strip()]

    # 3) Each numbered marker must start its own line (defensive).
    rebuilt = []
    for line in lines:
        rebuilt.extend(re.split(r'(?=\d+[.)]\s)', line))

    joined = "\n".join(p.strip() for p in rebuilt if p and p.strip())
    return joined
