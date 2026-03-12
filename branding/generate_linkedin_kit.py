#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BRANDING = ROOT / "branding"
LINKEDIN = BRANDING / "linkedin"

LOGO = BRANDING / "logos" / "logo-primary.png"
BOX_ART = BRANDING / "box-art" / "product-box.png"
LANDING = BRANDING / "landing" / "landing-page.png"
SPLASH = BRANDING / "splash" / "splash-screen.png"
ICON = BRANDING / "icons" / "512x512.png"

BG = "#0b0f14"
PANEL = "#0f1724"
PANEL_ALT = "#111d2c"
PRIMARY = "#00ffd1"
SECONDARY = "#00a8ff"
ACCENT = "#ff3b81"
TEXT = "#e6edf3"
MUTED = "#94a7b7"
GRID = "#13202b"


def ensure_dirs() -> None:
    LINKEDIN.mkdir(parents=True, exist_ok=True)


def load_font(size: int, *, bold: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates: list[str]
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
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    color = hex_color.lstrip("#")
    return tuple(int(color[index:index + 2], 16) for index in (0, 2, 4)) + (alpha,)


def make_canvas(width: int, height: int) -> Image.Image:
    base = Image.new("RGBA", (width, height), rgba(BG))
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for x in range(0, width, 56):
        draw.line([(x, 0), (x, height)], fill=rgba(GRID, 38), width=1)
    for y in range(0, height, 56):
        draw.line([(0, y), (width, y)], fill=rgba(GRID, 38), width=1)
    base.alpha_composite(overlay)
    add_glow(base, (int(width * 0.24), int(height * 0.26)), int(min(width, height) * 0.18), PRIMARY, 28)
    add_glow(base, (int(width * 0.76), int(height * 0.36)), int(min(width, height) * 0.22), SECONDARY, 22)
    return base


def add_glow(image: Image.Image, center: tuple[int, int], radius: int, color: str, alpha: int) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x, y = center
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=rgba(color, alpha))
    image.alpha_composite(layer.filter(ImageFilter.GaussianBlur(max(8, radius // 2))))


def rounded_panel(image: Image.Image, box: tuple[int, int, int, int], *, fill: str = PANEL, outline: str = SECONDARY, radius: int = 28, width: int = 2) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle(box, radius=radius, fill=rgba(fill, 235), outline=rgba(outline, 220), width=width)
    image.alpha_composite(layer)


def paste_asset(canvas: Image.Image, asset_path: Path, box: tuple[int, int, int, int], *, background: str | None = None, radius: int = 28) -> None:
    asset = Image.open(asset_path).convert("RGBA")
    box_width = box[2] - box[0]
    box_height = box[3] - box[1]
    if background:
        rounded_panel(canvas, box, fill=background, outline=SECONDARY, radius=radius, width=2)
    ratio = min(box_width / asset.width, box_height / asset.height)
    target_size = (max(1, int(asset.width * ratio)), max(1, int(asset.height * ratio)))
    asset = asset.resize(target_size, Image.LANCZOS)
    offset_x = box[0] + (box_width - asset.width) // 2
    offset_y = box[1] + (box_height - asset.height) // 2
    mask = Image.new("L", target_size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, target_size[0], target_size[1]), radius=max(16, radius - 6), fill=255)
    canvas.paste(asset, (offset_x, offset_y), mask)


def text_block(draw: ImageDraw.ImageDraw, origin: tuple[int, int], lines: list[str], *, font: ImageFont.ImageFont, fill: str, spacing: int) -> int:
    x, y = origin
    current_y = y
    for line in lines:
        draw.text((x, current_y), line, font=font, fill=rgba(fill))
        bbox = draw.textbbox((x, current_y), line, font=font)
        current_y = bbox[3] + spacing
    return current_y


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    if not words:
        return [""]
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        width = draw.textbbox((0, 0), candidate, font=font)[2]
        if width <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def draw_wrapped_text(
    draw: ImageDraw.ImageDraw,
    origin: tuple[int, int],
    text: str,
    *,
    font: ImageFont.ImageFont,
    fill: str,
    max_width: int,
    line_spacing: int = 10,
) -> int:
    lines = wrap_text(draw, text, font, max_width)
    return text_block(draw, origin, lines, font=font, fill=fill, spacing=line_spacing)


def draw_badges(draw: ImageDraw.ImageDraw, origin: tuple[int, int], labels: list[str]) -> None:
    x, y = origin
    font = load_font(28, bold=True, mono=True)
    cursor_x = x
    for index, label in enumerate(labels):
        fill = PRIMARY if index % 2 == 0 else SECONDARY
        text_width = draw.textbbox((0, 0), label, font=font)[2]
        badge_width = text_width + 46
        draw.rounded_rectangle((cursor_x, y, cursor_x + badge_width, y + 48), radius=20, outline=rgba(fill), fill=rgba(PANEL_ALT, 230), width=2)
        draw.text((cursor_x + 22, y + 10), label, font=font, fill=rgba(fill))
        cursor_x += badge_width + 16


def generate_hero() -> None:
    canvas = make_canvas(1200, 627)
    draw = ImageDraw.Draw(canvas)
    rounded_panel(canvas, (34, 32, 1166, 595), fill="#0d1521", outline=SECONDARY, radius=34, width=3)
    paste_asset(canvas, LOGO, (80, 54, 650, 250), radius=24)
    title_font = load_font(42, bold=True)
    subtitle_font = load_font(28)
    cta_font = load_font(22, bold=True, mono=True)
    next_y = draw_wrapped_text(
        draw,
        (82, 256),
        "Your Local AI Cybersecurity Workstation",
        font=title_font,
        fill=TEXT,
        max_width=560,
        line_spacing=10,
    )
    subtitle_bottom = draw_wrapped_text(
        draw,
        (82, next_y + 6),
        "Private local AI workflows for coding, scan analysis, and cyber tools.",
        font=subtitle_font,
        fill=MUTED,
        max_width=560,
        line_spacing=8,
    )
    button_top = 518
    button_bottom = button_top + 54
    draw.rounded_rectangle((82, button_top, 618, button_bottom), radius=24, outline=rgba(PRIMARY), fill=rgba(PANEL_ALT, 235), width=2)
    draw.text((106, button_top + 17), "Open for demos, hiring, and collaboration", font=cta_font, fill=rgba(PRIMARY))
    paste_asset(canvas, LANDING, (706, 84, 1110, 520), background="#09111a", radius=26)
    canvas.save(LINKEDIN / "linkedin-hero.png")


def generate_carousel_intro() -> None:
    canvas = make_canvas(1080, 1080)
    draw = ImageDraw.Draw(canvas)
    rounded_panel(canvas, (42, 42, 1038, 1038), fill="#0d1521", outline=SECONDARY, radius=36, width=3)
    paste_asset(canvas, LOGO, (88, 82, 776, 270), radius=26)
    draw.text((88, 314), "Launch Announcement", font=load_font(54, bold=True), fill=rgba(TEXT))
    summary_bottom = draw_wrapped_text(
        draw,
        (88, 390),
        "Hackloi AI Cyber Lab is a local-first AI workstation for developers, analysts, and cybersecurity workflows.",
        font=load_font(30),
        fill=MUTED,
        max_width=480,
        line_spacing=8,
    )
    draw_badges(draw, (88, summary_bottom + 18), ["Local AI", "Cyber Tools"])
    draw_badges(draw, (88, summary_bottom + 84), ["Scan Analyzer", "AI Agents"])
    paste_asset(canvas, BOX_ART, (620, 392, 980, 864), background="#09111a", radius=28)
    draw_wrapped_text(
        draw,
        (88, 902),
        "Built in Tanzania for teams and builders who want private, powerful workflows.",
        font=load_font(28),
        fill=PRIMARY,
        max_width=900,
        line_spacing=8,
    )
    canvas.save(LINKEDIN / "linkedin-carousel-01-intro.png")


def generate_carousel_features() -> None:
    canvas = make_canvas(1080, 1080)
    draw = ImageDraw.Draw(canvas)
    rounded_panel(canvas, (42, 42, 1038, 1038), fill="#0d1521", outline=PRIMARY, radius=36, width=3)
    draw.text((78, 90), "What the product does", font=load_font(60, bold=True), fill=rgba(TEXT))
    features = [
        "AI coding assistance in a desktop workspace",
        "Structured scan and terminal output analysis",
        "Cyber tool command workflows with user confirmation",
        "Local multi-agent support for coding, analysis, and documentation",
        "Offline-capable operation with local Ollama models",
    ]
    cursor_y = 206
    bullet_font = load_font(28)
    for feature in features:
        draw.rounded_rectangle((82, cursor_y + 2, 116, cursor_y + 36), radius=12, fill=rgba(SECONDARY))
        next_y = draw_wrapped_text(
            draw,
            (142, cursor_y - 8),
            feature,
            font=bullet_font,
            fill=TEXT,
            max_width=820,
            line_spacing=10,
        )
        cursor_y = next_y + 34
    paste_asset(canvas, LANDING, (102, 750, 978, 970), background="#09111a", radius=24)
    canvas.save(LINKEDIN / "linkedin-carousel-02-features.png")


def generate_carousel_privacy() -> None:
    canvas = make_canvas(1080, 1080)
    draw = ImageDraw.Draw(canvas)
    rounded_panel(canvas, (42, 42, 1038, 1038), fill="#0d1521", outline=SECONDARY, radius=36, width=3)
    draw.text((78, 92), "Why local-first matters", font=load_font(60, bold=True), fill=rgba(TEXT))
    draw_wrapped_text(
        draw,
        (78, 174),
        "Hackloi AI Cyber Lab is designed for private workflows where user control matters.",
        font=load_font(30),
        fill=MUTED,
        max_width=900,
        line_spacing=8,
    )
    text_block(
        draw,
        (82, 280),
        [
            "Models run locally through Ollama",
            "No hidden cloud dependency in core usage",
            "Files stay on the machine",
            "Tool execution stays visible and explicit",
        ],
        font=load_font(34),
        fill=PRIMARY,
        spacing=24,
    )
    paste_asset(canvas, SPLASH, (570, 248, 968, 728), background="#09111a", radius=28)
    draw_wrapped_text(
        draw,
        (82, 890),
        "This makes it a stronger fit for labs, demos, consulting, and private experimentation.",
        font=load_font(28),
        fill=TEXT,
        max_width=900,
        line_spacing=8,
    )
    canvas.save(LINKEDIN / "linkedin-carousel-03-local-privacy.png")


def generate_carousel_tanzania() -> None:
    canvas = make_canvas(1080, 1080)
    draw = ImageDraw.Draw(canvas)
    rounded_panel(canvas, (42, 42, 1038, 1038), fill="#0d1521", outline=ACCENT, radius=36, width=3)
    paste_asset(canvas, ICON, (92, 110, 360, 378), background="#09111a", radius=28)
    draw.text((404, 122), "Built in Tanzania", font=load_font(60, bold=True), fill=rgba(TEXT))
    draw_wrapped_text(
        draw,
        (404, 222),
        "A local product with a global standard.",
        font=load_font(30),
        fill=MUTED,
        max_width=520,
        line_spacing=8,
    )
    text_block(
        draw,
        (92, 464),
        [
            "Hackloi AI Cyber Lab was built in Tanzania",
            "with a focus on product quality, privacy, and",
            "practical local AI workflows for real users.",
        ],
        font=load_font(40),
        fill=TEXT,
        spacing=20,
    )
    draw.rounded_rectangle((92, 748, 988, 868), radius=30, outline=rgba(PRIMARY), fill=rgba(PANEL_ALT, 235), width=2)
    draw_wrapped_text(
        draw,
        (128, 770),
        "Open to demos, partnerships, consulting, product feedback, and serious conversations.",
        font=load_font(24, bold=True),
        fill=PRIMARY,
        max_width=820,
        line_spacing=8,
    )
    draw_wrapped_text(
        draw,
        (92, 918),
        "If this interests you, invite people to DM or connect after the post.",
        font=load_font(28),
        fill=TEXT,
        max_width=900,
        line_spacing=8,
    )
    canvas.save(LINKEDIN / "linkedin-carousel-04-built-in-tanzania.png")


def generate_contact_card() -> None:
    canvas = make_canvas(1200, 627)
    draw = ImageDraw.Draw(canvas)
    rounded_panel(canvas, (36, 36, 1164, 591), fill="#0d1521", outline=PRIMARY, radius=34, width=3)
    paste_asset(canvas, LOGO, (74, 72, 640, 236), radius=20)
    title_bottom = draw_wrapped_text(
        draw,
        (78, 262),
        "Interested in local AI, cybersecurity workflows, or a product demo?",
        font=load_font(38, bold=True),
        fill=TEXT,
        max_width=700,
        line_spacing=8,
    )
    subtitle_bottom = draw_wrapped_text(
        draw,
        (78, title_bottom + 8),
        "Send a message to connect about demos, consulting, hiring, or collaboration.",
        font=load_font(28),
        fill=MUTED,
        max_width=700,
        line_spacing=8,
    )
    badge_y = subtitle_bottom + 18
    draw_badges(draw, (78, badge_y), ["Demo", "Consulting", "Hiring", "Collaboration"])
    paste_asset(canvas, ICON, (850, 170, 1070, 390), background="#09111a", radius=28)
    canvas.save(LINKEDIN / "linkedin-contact-card.png")


def main() -> None:
    ensure_dirs()
    generate_hero()
    generate_carousel_intro()
    generate_carousel_features()
    generate_carousel_privacy()
    generate_carousel_tanzania()
    generate_contact_card()
    print("LinkedIn kit generated.")


if __name__ == "__main__":
    main()
