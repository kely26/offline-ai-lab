#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BRANDING = ROOT / "branding"
LOGOS = BRANDING / "logos"
ICONS = BRANDING / "icons"
SPLASH = BRANDING / "splash"
BOX_ART = BRANDING / "box-art"
LANDING = BRANDING / "landing"
WEBUI_ASSETS = ROOT / "webui" / "assets"
TAURI_ICONS = ROOT / "src-tauri" / "icons"


BG = "#0b0f14"
PRIMARY = "#00ffd1"
SECONDARY = "#00a8ff"
ACCENT = "#ff3b81"
TEXT = "#e6edf3"
MUTED = "#9bb0c3"
GRID = "#13202b"


def ensure_dirs() -> None:
    for path in (LOGOS, ICONS, SPLASH, BOX_ART, LANDING, WEBUI_ASSETS, TAURI_ICONS):
        path.mkdir(parents=True, exist_ok=True)


def load_font(size: int, bold: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates: list[str] = []
    if mono and bold:
        candidates = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationMono-Bold.ttf",
        ]
    elif mono:
        candidates = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationMono-Regular.ttf",
        ]
    elif bold:
        candidates = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
        ]
    else:
        candidates = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
        ]

    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def hex_rgba(color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    color = color.lstrip("#")
    return tuple(int(color[index:index + 2], 16) for index in (0, 2, 4)) + (alpha,)


def make_canvas(width: int, height: int, color: str = BG) -> Image.Image:
    return Image.new("RGBA", (width, height), hex_rgba(color))


def add_grid(image: Image.Image, spacing: int = 44, alpha: int = 32) -> None:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    width, height = image.size
    for x in range(0, width, spacing):
        draw.line([(x, 0), (x, height)], fill=hex_rgba(GRID, alpha), width=1)
    for y in range(0, height, spacing):
        draw.line([(0, y), (width, y)], fill=hex_rgba(GRID, alpha), width=1)
    image.alpha_composite(overlay)


def add_radial_glow(image: Image.Image, center: tuple[int, int], radius: int, color: str, alpha: int) -> None:
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    x, y = center
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=hex_rgba(color, alpha))
    glow = glow.filter(ImageFilter.GaussianBlur(radius // 2))
    image.alpha_composite(glow)


def draw_glow_line(overlay: Image.Image, points: Iterable[tuple[float, float]], color: str, width: int, blur: int = 18) -> None:
    line = Image.new("RGBA", overlay.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(line)
    draw.line(list(points), fill=hex_rgba(color, 255), width=width, joint="curve")
    overlay.alpha_composite(line.filter(ImageFilter.GaussianBlur(blur)))
    overlay.alpha_composite(line)


def draw_dragon_emblem(image: Image.Image, center: tuple[int, int], size: int, background_square: bool = False) -> None:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    cx, cy = center
    radius = size // 2

    if background_square:
      panel = (
          cx - radius - int(size * 0.12),
          cy - radius - int(size * 0.12),
          cx + radius + int(size * 0.12),
          cy + radius + int(size * 0.12),
      )
      draw.rounded_rectangle(panel, radius=int(size * 0.16), fill=hex_rgba("#09111a", 255), outline=hex_rgba(SECONDARY, 70), width=max(3, size // 28))

    add_radial_glow(image, center, int(size * 0.7), SECONDARY, 34)
    add_radial_glow(image, center, int(size * 0.55), PRIMARY, 26)

    outer = (cx - radius, cy - radius, cx + radius, cy + radius)
    inner = (cx - int(radius * 0.72), cy - int(radius * 0.72), cx + int(radius * 0.72), cy + int(radius * 0.72))
    core = (cx - int(radius * 0.34), cy - int(radius * 0.34), cx + int(radius * 0.34), cy + int(radius * 0.34))

    draw.ellipse(outer, outline=hex_rgba(SECONDARY, 255), width=max(4, size // 20))
    draw.ellipse(inner, outline=hex_rgba(PRIMARY, 255), width=max(3, size // 26))
    draw.rounded_rectangle(core, radius=max(12, size // 12), outline=hex_rgba(PRIMARY, 255), width=max(3, size // 24))

    trace_width = max(3, size // 30)
    trace_gap = int(radius * 0.5)
    trace_points = [
        ((cx - trace_gap, cy), (cx - radius + int(size * 0.1), cy)),
        ((cx + trace_gap, cy), (cx + radius - int(size * 0.1), cy)),
        ((cx, cy - trace_gap), (cx, cy - radius + int(size * 0.1))),
        ((cx, cy + trace_gap), (cx, cy + radius - int(size * 0.1))),
    ]
    for start, end in trace_points:
        draw.line([start, end], fill=hex_rgba(PRIMARY, 255), width=trace_width)
        draw.ellipse((end[0] - trace_width * 1.2, end[1] - trace_width * 1.2, end[0] + trace_width * 1.2, end[1] + trace_width * 1.2), fill=hex_rgba(SECONDARY, 255))

    body = [
        (cx + radius * 0.78, cy - radius * 0.38),
        (cx + radius * 0.46, cy - radius * 0.9),
        (cx - radius * 0.28, cy - radius * 0.96),
        (cx - radius * 0.86, cy - radius * 0.44),
        (cx - radius * 0.92, cy + radius * 0.32),
        (cx - radius * 0.28, cy + radius * 0.88),
        (cx + radius * 0.44, cy + radius * 0.92),
        (cx + radius * 0.92, cy + radius * 0.28),
    ]
    draw_glow_line(overlay, body, PRIMARY, max(10, size // 12), blur=max(8, size // 18))

    horn = [
        (cx - radius * 0.44, cy - radius * 0.9),
        (cx - radius * 0.16, cy - radius * 1.2),
        (cx - radius * 0.04, cy - radius * 0.86),
    ]
    jaw = [
        (cx + radius * 0.74, cy - radius * 0.32),
        (cx + radius * 1.12, cy - radius * 0.08),
        (cx + radius * 0.72, cy + radius * 0.08),
        (cx + radius * 0.46, cy - radius * 0.05),
    ]
    wing = [
        (cx - radius * 0.16, cy - radius * 0.18),
        (cx - radius * 0.82, cy - radius * 0.08),
        (cx - radius * 0.38, cy + radius * 0.26),
    ]
    tail = [
        (cx + radius * 0.76, cy + radius * 0.26),
        (cx + radius * 1.08, cy + radius * 0.5),
        (cx + radius * 0.82, cy + radius * 0.72),
    ]
    for shape in (horn, jaw, wing, tail):
        draw_glow_line(overlay, shape, SECONDARY, max(8, size // 18), blur=max(6, size // 26))

    eye_r = max(3, size // 42)
    eye_center = (int(cx + radius * 0.66), int(cy - radius * 0.14))
    add_radial_glow(image, eye_center, eye_r * 10, ACCENT, 40)
    draw.ellipse((eye_center[0] - eye_r, eye_center[1] - eye_r, eye_center[0] + eye_r, eye_center[1] + eye_r), fill=hex_rgba(ACCENT, 255))

    image.alpha_composite(overlay)


def draw_wordmark(image: Image.Image, origin: tuple[int, int], max_width: int) -> None:
    draw = ImageDraw.Draw(image)
    x, y = origin
    title_font = load_font(88, bold=True)
    subtitle_font = load_font(46, bold=True, mono=True)
    tagline_font = load_font(30)

    draw.text((x, y), "Hackloi", font=title_font, fill=hex_rgba(TEXT, 255))
    title_width = draw.textbbox((x, y), "Hackloi", font=title_font)[2] - x
    draw.text((x + title_width + 26, y + 12), "AI CYBER LAB", font=subtitle_font, fill=hex_rgba(PRIMARY, 255))
    draw.text((x, y + 118), "Your Local AI Cybersecurity Workstation", font=tagline_font, fill=hex_rgba(MUTED, 255))
    draw.rounded_rectangle((x, y + 170, min(x + max_width, x + 620), y + 178), radius=4, fill=hex_rgba(SECONDARY, 255))


def save_logo_primary() -> None:
    width, height = 1600, 560
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw_dragon_emblem(image, (250, height // 2), 300)
    add_radial_glow(image, (250, height // 2), 220, PRIMARY, 20)
    draw_wordmark(image, (470, 155), 680)
    image.save(LOGOS / "logo-primary.png")

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 560" fill="none">
  <defs>
    <filter id="g" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="18" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <g transform="translate(250 280)">
    <circle r="150" stroke="{SECONDARY}" stroke-width="18" opacity="0.95"/>
    <circle r="108" stroke="{PRIMARY}" stroke-width="12"/>
    <rect x="-52" y="-52" width="104" height="104" rx="18" stroke="{PRIMARY}" stroke-width="10"/>
    <path d="M-76 0H-138M76 0H138M0-76V-138M0 76V138" stroke="{PRIMARY}" stroke-width="10" stroke-linecap="round"/>
    <circle cx="-138" cy="0" r="10" fill="{SECONDARY}"/>
    <circle cx="138" cy="0" r="10" fill="{SECONDARY}"/>
    <circle cx="0" cy="-138" r="10" fill="{SECONDARY}"/>
    <circle cx="0" cy="138" r="10" fill="{SECONDARY}"/>
    <path d="M116 -56C70 -133 -43 -164 -120 -66C-160 -16 -163 78 -43 138C36 177 139 112 143 43" stroke="{PRIMARY}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" filter="url(#g)"/>
    <path d="M-68 -135L-24 -178L-4 -128" stroke="{SECONDARY}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" filter="url(#g)"/>
    <path d="M104 -46L165 -12L111 12L74 -8" stroke="{SECONDARY}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" filter="url(#g)"/>
    <path d="M-24 -25L-121 -10L-55 38" stroke="{SECONDARY}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" filter="url(#g)"/>
    <path d="M112 40L164 80L122 115" stroke="{SECONDARY}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" filter="url(#g)"/>
    <circle cx="98" cy="-21" r="8" fill="{ACCENT}"/>
  </g>
  <text x="470" y="226" fill="{TEXT}" font-size="112" font-weight="700" font-family="DejaVu Sans, Arial, sans-serif">Hackloi</text>
  <text x="930" y="226" fill="{PRIMARY}" font-size="56" font-weight="700" font-family="DejaVu Sans Mono, monospace">AI CYBER LAB</text>
  <text x="470" y="332" fill="{MUTED}" font-size="34" font-family="DejaVu Sans, Arial, sans-serif">Your Local AI Cybersecurity Workstation</text>
  <rect x="470" y="370" width="640" height="10" rx="5" fill="{SECONDARY}"/>
</svg>"""
    (LOGOS / "logo-primary.svg").write_text(svg, encoding="utf-8")

    mono = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 560" fill="none">
  <g transform="translate(250 280)" stroke="{TEXT}" stroke-linecap="round" stroke-linejoin="round">
    <circle r="150" stroke-width="18"/>
    <circle r="108" stroke-width="12"/>
    <rect x="-52" y="-52" width="104" height="104" rx="18" stroke-width="10"/>
    <path d="M-76 0H-138M76 0H138M0-76V-138M0 76V138" stroke-width="10"/>
    <circle cx="-138" cy="0" r="10" fill="{TEXT}" stroke="none"/>
    <circle cx="138" cy="0" r="10" fill="{TEXT}" stroke="none"/>
    <circle cx="0" cy="-138" r="10" fill="{TEXT}" stroke="none"/>
    <circle cx="0" cy="138" r="10" fill="{TEXT}" stroke="none"/>
    <path d="M116 -56C70 -133 -43 -164 -120 -66C-160 -16 -163 78 -43 138C36 177 139 112 143 43" stroke-width="26"/>
    <path d="M-68 -135L-24 -178L-4 -128" stroke-width="18"/>
    <path d="M104 -46L165 -12L111 12L74 -8" stroke-width="18"/>
    <path d="M-24 -25L-121 -10L-55 38" stroke-width="16"/>
    <path d="M112 40L164 80L122 115" stroke-width="16"/>
    <circle cx="98" cy="-21" r="8" fill="{TEXT}" stroke="none"/>
  </g>
  <text x="470" y="226" fill="{TEXT}" font-size="112" font-weight="700" font-family="DejaVu Sans, Arial, sans-serif">Hackloi</text>
  <text x="930" y="226" fill="{TEXT}" font-size="56" font-weight="700" font-family="DejaVu Sans Mono, monospace">AI CYBER LAB</text>
  <text x="470" y="332" fill="{TEXT}" font-size="34" font-family="DejaVu Sans, Arial, sans-serif">Your Local AI Cybersecurity Workstation</text>
</svg>"""
    (LOGOS / "logo-monochrome.svg").write_text(mono, encoding="utf-8")


def save_square_icon(size: int) -> Image.Image:
    scale = 4
    image = make_canvas(size * scale, size * scale, BG)
    add_grid(image, spacing=max(18, size // 2), alpha=22)
    draw_dragon_emblem(image, (image.width // 2, image.height // 2), int(size * scale * 0.62), background_square=True)
    final = image.resize((size, size), Image.Resampling.LANCZOS)
    final.save(ICONS / f"{size}x{size}.png")
    return final


def save_icon_source_svg() -> None:
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" rx="108" fill="{BG}"/>
  <circle cx="256" cy="256" r="156" stroke="{SECONDARY}" stroke-width="24"/>
  <circle cx="256" cy="256" r="112" stroke="{PRIMARY}" stroke-width="16"/>
  <rect x="202" y="202" width="108" height="108" rx="22" stroke="{PRIMARY}" stroke-width="14"/>
  <path d="M177 256H120M335 256H392M256 177V120M256 335V392" stroke="{PRIMARY}" stroke-width="14" stroke-linecap="round"/>
  <circle cx="120" cy="256" r="12" fill="{SECONDARY}"/>
  <circle cx="392" cy="256" r="12" fill="{SECONDARY}"/>
  <circle cx="256" cy="120" r="12" fill="{SECONDARY}"/>
  <circle cx="256" cy="392" r="12" fill="{SECONDARY}"/>
  <path d="M377 197C328 108 202 89 132 183C88 241 96 342 188 393C275 442 391 377 393 284" stroke="{PRIMARY}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M165 128L220 88L240 146" stroke="{SECONDARY}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M350 202L411 232L351 259L315 236" stroke="{SECONDARY}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M225 226L117 242L189 293" stroke="{SECONDARY}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M360 296L414 336L374 371" stroke="{SECONDARY}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="344" cy="234" r="10" fill="{ACCENT}"/>
</svg>"""
    (ICONS / "icon-square.svg").write_text(svg, encoding="utf-8")


def save_splash() -> None:
    width, height = 1600, 900
    image = make_canvas(width, height, BG)
    add_grid(image, spacing=48, alpha=28)
    add_radial_glow(image, (width // 2, height // 2 - 20), 360, SECONDARY, 24)
    add_radial_glow(image, (width // 2, height // 2 - 20), 280, PRIMARY, 18)
    draw_dragon_emblem(image, (width // 2, 360), 380)

    draw = ImageDraw.Draw(image)
    title = load_font(86, bold=True)
    tag = load_font(34)
    mono = load_font(30, mono=True, bold=True)
    title_box = draw.textbbox((0, 0), "Hackloi AI Cyber Lab", font=title)
    title_width = title_box[2] - title_box[0]
    draw.text(((width - title_width) / 2, 585), "Hackloi AI Cyber Lab", font=title, fill=hex_rgba(TEXT, 255))
    tag_text = "Your Local AI Cybersecurity Workstation"
    tag_box = draw.textbbox((0, 0), tag_text, font=tag)
    tag_width = tag_box[2] - tag_box[0]
    draw.text(((width - tag_width) / 2, 690), tag_text, font=tag, fill=hex_rgba(MUTED, 255))
    draw.text((width / 2 - 172, 760), "LOCAL  AI  ·  TOOLING  ·  ANALYSIS", font=mono, fill=hex_rgba(PRIMARY, 255))
    image.save(SPLASH / "splash-screen.png")
    image.save(WEBUI_ASSETS / "startup-splash.png")


def save_box_art() -> None:
    width, height = 1600, 2000
    image = make_canvas(width, height, BG)
    add_grid(image, spacing=54, alpha=24)
    add_radial_glow(image, (900, 620), 420, SECONDARY, 20)
    add_radial_glow(image, (900, 620), 280, ACCENT, 16)
    draw = ImageDraw.Draw(image)

    front = (290, 170, 1320, 1830)
    spine = (180, 240, 320, 1770)
    draw.rounded_rectangle(front, radius=42, fill=hex_rgba("#0f151e", 255), outline=hex_rgba(SECONDARY, 120), width=4)
    draw.rounded_rectangle(spine, radius=34, fill=hex_rgba("#081018", 255), outline=hex_rgba(PRIMARY, 120), width=4)
    draw_dragon_emblem(image, (820, 690), 460)

    title = load_font(78, bold=True)
    sub = load_font(34)
    feature_font = load_font(32, bold=True, mono=True)
    draw.text((420, 220), "Hackloi AI Cyber Lab", font=title, fill=hex_rgba(TEXT, 255))
    draw.text((420, 320), "Your Local AI Cybersecurity Workstation", font=sub, fill=hex_rgba(MUTED, 255))
    draw.text((228, 410), "HACKLOI", font=load_font(36, bold=True, mono=True), fill=hex_rgba(PRIMARY, 255), anchor="mm")
    draw.text((228, 460), "AI", font=load_font(42, bold=True), fill=hex_rgba(TEXT, 255), anchor="mm")
    draw.text((228, 515), "CYBER", font=load_font(36, bold=True, mono=True), fill=hex_rgba(SECONDARY, 255), anchor="mm")
    draw.text((228, 565), "LAB", font=load_font(36, bold=True, mono=True), fill=hex_rgba(ACCENT, 255), anchor="mm")

    features = ["Local AI", "Code Workspace", "Scan Analyzer", "AI Agents", "Cyber Tools"]
    start_y = 1320
    for index, feature in enumerate(features):
        y = start_y + index * 92
        draw.rounded_rectangle((430, y - 10, 1170, y + 54), radius=20, fill=hex_rgba("#111b24", 225), outline=hex_rgba(PRIMARY if index % 2 == 0 else SECONDARY, 90), width=2)
        draw.text((470, y), feature, font=feature_font, fill=hex_rgba(TEXT, 255))
    image.save(BOX_ART / "product-box.png")


def save_landing_mockup() -> None:
    width, height = 1600, 2100
    image = make_canvas(width, height, BG)
    add_grid(image, spacing=56, alpha=22)
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle((60, 60, width - 60, height - 60), radius=36, fill=hex_rgba("#0d141d", 255), outline=hex_rgba(SECONDARY, 90), width=3)
    draw.rounded_rectangle((90, 90, width - 90, 150), radius=24, fill=hex_rgba("#101823", 255))
    draw.text((140, 104), "Hackloi AI Cyber Lab", font=load_font(36, bold=True), fill=hex_rgba(TEXT, 255))
    draw.text((1110, 108), "DOWNLOAD", font=load_font(22, bold=True, mono=True), fill=hex_rgba(PRIMARY, 255))

    hero = (120, 200, width - 120, 760)
    draw.rounded_rectangle(hero, radius=34, fill=hex_rgba("#0f1720", 255), outline=hex_rgba(PRIMARY, 86), width=3)
    add_radial_glow(image, (1150, 440), 220, SECONDARY, 28)
    draw_dragon_emblem(image, (1120, 460), 300)
    draw.text((180, 270), "Hackloi AI Cyber Lab", font=load_font(66, bold=True), fill=hex_rgba(TEXT, 255))
    draw.text((180, 360), "Your Local AI Cybersecurity Workstation", font=load_font(34), fill=hex_rgba(MUTED, 255))
    draw.text((180, 440), "Local AI models\nAI coding assistant\nScan analysis\nCyber tool integration\nMulti-agent workflows", font=load_font(28, bold=True), fill=hex_rgba(PRIMARY, 255), spacing=12)

    feature_titles = [
        ("Local AI Models", PRIMARY),
        ("AI Coding Assistant", SECONDARY),
        ("Scan Analysis", ACCENT),
        ("Cyber Tool Integration", PRIMARY),
        ("Multi-Agent Workflows", SECONDARY),
    ]
    base_y = 860
    for index, (label, color) in enumerate(feature_titles):
        row = index // 2
        col = index % 2
        x = 120 + col * 690
        y = base_y + row * 250
        w = 610 if index < 4 else 1280
        if index == 4:
            x = 160
            y = 1360
        draw.rounded_rectangle((x, y, x + w, y + 180), radius=28, fill=hex_rgba("#111a24", 255), outline=hex_rgba(color, 92), width=3)
        draw.text((x + 36, y + 34), label, font=load_font(34, bold=True), fill=hex_rgba(TEXT, 255))
        draw.text((x + 36, y + 92), "Private-by-default workflows with a clean, neon cyber-lab aesthetic.", font=load_font(22), fill=hex_rgba(MUTED, 255))

    pricing_y = 1610
    draw.text((140, pricing_y), "Pricing", font=load_font(40, bold=True), fill=hex_rgba(TEXT, 255))
    pricing_cards = [
        ("Standard Edition", "$26", PRIMARY, "Local chat, workspace, analyzer, and tools"),
        ("Pro Edition", "Coming Soon", ACCENT, "Expanded workflows and future premium bundles"),
    ]
    for index, (title, price, color, copy) in enumerate(pricing_cards):
        x = 140 + index * 650
        draw.rounded_rectangle((x, 1690, x + 580, 1910), radius=30, fill=hex_rgba("#101821", 255), outline=hex_rgba(color, 95), width=3)
        draw.text((x + 34, 1730), title, font=load_font(34, bold=True), fill=hex_rgba(TEXT, 255))
        draw.text((x + 34, 1796), price, font=load_font(46, bold=True, mono=True), fill=hex_rgba(color, 255))
        draw.text((x + 34, 1860), copy, font=load_font(22), fill=hex_rgba(MUTED, 255))

    draw.text((140, 1980), "Runs locally with Ollama. No cloud required.", font=load_font(24, bold=True), fill=hex_rgba(PRIMARY, 255))
    image.save(LANDING / "landing-page.png")


def sync_app_assets() -> None:
    icon_32 = ICONS / "32x32.png"
    icon_128 = ICONS / "128x128.png"
    icon_256 = ICONS / "256x256.png"
    icon_svg = ICONS / "icon-square.svg"
    (TAURI_ICONS / "32x32.png").write_bytes(icon_32.read_bytes())
    (TAURI_ICONS / "128x128.png").write_bytes(icon_128.read_bytes())
    (TAURI_ICONS / "128x128@2x.png").write_bytes(icon_256.read_bytes())
    (TAURI_ICONS / "icon-source.svg").write_text(icon_svg.read_text(encoding="utf-8"), encoding="utf-8")

    (WEBUI_ASSETS / "logo-primary.svg").write_text((LOGOS / "logo-primary.svg").read_text(encoding="utf-8"), encoding="utf-8")
    (WEBUI_ASSETS / "brand-icon.svg").write_text(icon_svg.read_text(encoding="utf-8"), encoding="utf-8")


def main() -> None:
    ensure_dirs()
    save_logo_primary()
    save_icon_source_svg()
    for size in (16, 32, 64, 128, 256, 512):
        save_square_icon(size)
    save_splash()
    save_box_art()
    save_landing_mockup()
    sync_app_assets()
    print("Branding assets generated.")


if __name__ == "__main__":
    main()
