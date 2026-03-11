from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "assets" / "mystree-logo.svg"
OUTPUT = ROOT / "src" / "assets" / "mystree-logo-clean.svg"


def main() -> None:
    svg = SOURCE.read_text(encoding="utf-8")
    # Remove any flat background rectangles if they exist and keep the logo transparent.
    svg = re.sub(r"<rect[^>]*?/>\s*", "", svg, flags=re.IGNORECASE)
    svg = re.sub(r'fill="white"', 'fill="none"', svg, flags=re.IGNORECASE)
    svg = re.sub(r"fill='#ffffff'", "fill='none'", svg, flags=re.IGNORECASE)
    if "fill=\"none\"" not in svg.split(">")[0]:
      svg = svg.replace("<svg ", "<svg fill=\"none\" ", 1)
    OUTPUT.write_text(svg, encoding="utf-8")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
