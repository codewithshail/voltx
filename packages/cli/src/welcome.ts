// @voltx/cli — Welcome banner with colorful gradient text

// ANSI escape helpers
const ESC = "\x1b[";
const RESET = `${ESC}0m`;
const ITALIC = `${ESC}3m`;

// RGB color support (works in most modern terminals)
function rgb(r: number, g: number, b: number, text: string): string {
  return `${ESC}38;2;${r};${g};${b}m${text}${RESET}`;
}

// Gradient: interpolate between two RGB colors
function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function gradientLine(text: string, from: RGB, to: RGB): string {
  const len = text.length;
  if (len === 0) return "";
  return text
    .split("")
    .map((char, i) => {
      const t = len === 1 ? 0 : i / (len - 1);
      const r = lerp(from.r, to.r, t);
      const g = lerp(from.g, to.g, t);
      const b = lerp(from.b, to.b, t);
      return rgb(r, g, b, char);
    })
    .join("");
}

// Multi-line gradient (shifts hue per line for a vertical gradient feel)
function gradientBlock(lines: string[], colors: RGB[]): string {
  return lines
    .map((line, i) => {
      const t = lines.length === 1 ? 0 : i / (lines.length - 1);
      const segIndex = t * (colors.length - 1);
      const fromIdx = Math.floor(segIndex);
      const toIdx = Math.min(fromIdx + 1, colors.length - 1);
      const localT = segIndex - fromIdx;
      const from = {
        r: lerp(colors[fromIdx].r, colors[toIdx].r, localT),
        g: lerp(colors[fromIdx].g, colors[toIdx].g, localT),
        b: lerp(colors[fromIdx].b, colors[toIdx].b, localT),
      };
      const to = {
        r: lerp(colors[Math.min(fromIdx + 1, colors.length - 1)].r, colors[Math.min(toIdx + 1, colors.length - 1)].r, localT),
        g: lerp(colors[Math.min(fromIdx + 1, colors.length - 1)].g, colors[Math.min(toIdx + 1, colors.length - 1)].g, localT),
        b: lerp(colors[Math.min(fromIdx + 1, colors.length - 1)].b, colors[Math.min(toIdx + 1, colors.length - 1)].b, localT),
      };
      return gradientLine(line, from, to);
    })
    .join("\n");
}

// ASCII art banner for VOLTX
const VOLTX_BANNER = [
  "  ██╗   ██╗ ██████╗ ██╗  ████████╗██╗  ██╗",
  "  ██║   ██║██╔═══██╗██║  ╚══██╔══╝╚██╗██╔╝",
  "  ██║   ██║██║   ██║██║     ██║    ╚███╔╝ ",
  "  ╚██╗ ██╔╝██║   ██║██║     ██║    ██╔██╗ ",
  "   ╚████╔╝ ╚██████╔╝███████╗██║   ██╔╝ ██╗",
  "    ╚═══╝   ╚═════╝ ╚══════╝╚═╝   ╚═╝  ╚═╝",
];

// Gradient colors: electric blue → purple → pink
const VOLTX_COLORS: RGB[] = [
  { r: 0, g: 180, b: 255 },   // electric blue
  { r: 120, g: 80, b: 255 },  // purple
  { r: 255, g: 50, b: 180 },  // hot pink
  { r: 255, g: 120, b: 50 },  // orange
];

// Dimmed horizontal rule
function dimRule(width = 48): string {
  return `  ${rgb(60, 60, 80, "─".repeat(width))}`;
}

export function printWelcomeBanner(projectName?: string): void {
  console.log("");
  console.log(gradientBlock(VOLTX_BANNER, VOLTX_COLORS));
  console.log("");
  console.log(
    `  ${ITALIC}${rgb(180, 180, 220, "The AI-first full-stack framework")}${RESET}`
  );
  console.log("");

  if (projectName) {
    console.log(
      `  ${ITALIC}${rgb(120, 220, 180, `Thank you for choosing VoltX! ⚡`)}${RESET}`
    );
    console.log(
      `  ${ITALIC}${rgb(160, 160, 200, `Your project "${projectName}" is ready to go.`)}${RESET}`
    );
    console.log("");
    console.log(`  ${rgb(100, 180, 255, "Next steps:")}`);
    console.log(`  ${rgb(200, 200, 220, `  cd ${projectName}`)}`);
    console.log(`  ${rgb(200, 200, 220, "  pnpm install")}`);
    console.log(`  ${rgb(200, 200, 220, "  pnpm dev          # or: npx voltx dev")}`);
    console.log("");
    console.log(dimRule());
    console.log("");
    console.log(
      `  ${rgb(255, 200, 80, "☕")} ${ITALIC}${rgb(200, 180, 140, "Love VoltX? Support us and fuel the next update:")}${RESET}`
    );
    console.log(
      `     ${rgb(255, 180, 100, "https://buymeacoffee.com/promptlyai")}` 
    );
    console.log("");
    console.log(dimRule());
    console.log("");
    console.log(
      `  ${ITALIC}${rgb(140, 140, 170, "Docs: https://voltx.co.in  •  GitHub: github.com/codewithshail/voltx")}${RESET}`
    );
    console.log(
      `  ${ITALIC}${rgb(100, 100, 130, "Made with ♥ by the Promptly AI Team")}${RESET}`
    );
    console.log("");
  }
}
