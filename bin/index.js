#!/usr/bin/env node
"use strict";

const https = require("https");
const { exec, spawnSync } = require("child_process");
const readline = require("readline");

const PKG = require("../package.json");
const API_URL = process.env.ZEPHINAX_API_URL || "https://zephinax.com/api/user";
const CONTENT_MARGIN = 1;

const DEFAULT_SKILLS = {
  Stack: "Next.js • React • Node.js • Express • MongoDB",
  Systems: "Embedded C/C++ • Firmware • Mechatronics",
  DevOps: "Docker • Docker Compose • Git • Linux"
};

const FALLBACK_PROFILE = {
  firstName: "Amirali",
  lastName: "Rajabi",
  displayName: "Zephinax",
  username: "zephinax",
  gender: "male",
  pronouns: "he/him",
  bio: "Interdisciplinary engineer turning ideas into functional products.",
  address: "Tehran, Iran",
  email: "zephinax@gmail.com",
  website: "https://zephinax.com",
  jobTitle: "Systems Engineer",
  about: `I'm Amirali, an interdisciplinary engineer with a background in mechatronics and practical experience across software development, hardware engineering, product development, and system integration.
My primary focus is turning ideas into functional products across the entire lifecycle — from system architecture, PCB design, and embedded firmware to full-stack web applications and cloud deployments.
I specialize in building complete systems: combining microcontrollers and embedded devices (ESP32, Arduino, Raspberry Pi) with modern web platforms (Next.js, React, Express, MongoDB, Docker). I enjoy designing scalable architectures, bridging physical hardware with web services, and solving real-world operational challenges.
Currently completing my studies in Industrial Mechatronics while working as a Systems Engineer, continually refining practical engineering and technical leadership skills.`,
  quote: "Zephinax represents the endless pursuit of innovation in the world of technology.",
  skills: DEFAULT_SKILLS,
  timeZone: "Asia/Tehran"
};

const color = {
  cyan: (str) => `\x1b[36m${str}\x1b[0m`,
  magenta: (str) => `\x1b[35m${str}\x1b[0m`,
  yellow: (str) => `\x1b[33m${str}\x1b[0m`,
  green: (str) => `\x1b[32m${str}\x1b[0m`,
  blue: (str) => `\x1b[34m${str}\x1b[0m`,
  bold: (str) => `\x1b[1m${str}\x1b[0m`,
  dim: (str) => `\x1b[2m${str}\x1b[0m`,
  italic: (str) => `\x1b[3m${str}\x1b[0m`
};

function hyperlink(text, url) {
  if (!url) return text;
  return `\u001b]8;;${url}\u0007${text}\u001b]8;;\u0007`;
}

function stripAnsi(str = "") {
  return str
    .replace(/\u001b\]8;;[^\u0007\x1b]*(\u0007|\u001b\\)/g, "")
    .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, "")
    .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");
}

function visibleLength(str = "") {
  return stripAnsi(str).length;
}

function parseAboutAndQuote(text) {
  if (!text) return { about: "", quote: "" };
  const lines = text.split(/\r?\n/);
  const quoteLines = [];
  const regularLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(">")) {
      quoteLines.push(trimmed.replace(/^>\s*/, ""));
    } else {
      regularLines.push(line);
    }
  }

  const cleanText = (str) =>
    str
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/^\s*also a\b/im, "Also a")
      .replace(/\r?\n\s*/g, "\n")
      .trim();

  return {
    about: cleanText(regularLines.join("\n")),
    quote: cleanText(quoteLines.join(" "))
  };
}

function wrapText(text, width, indent = 0) {
  if (!text) return [];
  const indentStr = " ".repeat(indent);
  return text
    .split(/\r?\n/)
    .map((para) => para.trim())
    .filter(Boolean)
    .flatMap((para) => {
      const words = para.split(/\s+/);
      const lines = [];
      let current = "";

      words.forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;
        if (visibleLength(candidate) > width) {
          if (current) lines.push(current);
          current = word;
        } else {
          current = candidate;
        }
      });
      if (current) lines.push(current);
      return lines.map((l) => `${indentStr}${l}`);
    });
}

function divider(char = "-", length = 60) {
  return char.repeat(Math.max(0, length));
}

function boxTop(label, width) {
  const title = label ? ` ${label} ` : "";
  const dash = Math.max(0, width - 2 - title.length);
  return `╭${title}${divider("─", dash)}╮`;
}

function boxBottom(width) {
  return `╰${divider("─", Math.max(0, width - 2))}╯`;
}

function boxLine(text, width) {
  const inner = Math.max(0, width - 4 - CONTENT_MARGIN * 2);
  const content = text || "";
  const visLen = visibleLength(content);
  const needsTruncate = visLen > inner;
  const raw = needsTruncate ? `${stripAnsi(content).slice(0, inner - 1)}…` : content;
  const padding = Math.max(0, inner - visibleLength(raw));
  const margin = " ".repeat(CONTENT_MARGIN);
  return `│ ${margin}${raw}${" ".repeat(padding)}${margin} │`;
}

function boxDivider(label, width) {
  const tag = label ? ` ${label.toUpperCase()} ` : "";
  const lineLen = Math.max(0, width - 2 - tag.length);
  return `├${tag}${divider("─", lineLen)}┤`;
}

function fieldLine(label, value, width, linkUrl = null) {
  if (!value) return null;
  const labelText = `${label}:`.padEnd(10);
  const formattedVal = linkUrl ? hyperlink(color.cyan(value), linkUrl) : value;
  return boxLine(`${color.yellow(labelText)} ${formattedVal}`, width);
}

function render(profile, widthOverride) {
  const { about, quote } = parseAboutAndQuote(profile.about);
  const finalQuote = profile.quote || quote;
  const skills = profile.skills || DEFAULT_SKILLS;

  const header =
    `${color.bold(profile.displayName || profile.username || "Zephinax")} ${profile.pronouns ? color.dim(`(${profile.pronouns})`) : ""}`.trim();
  const fullName =
    profile.firstName || profile.lastName
      ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
      : null;

  const terminalCols = process.stdout.columns || 80;
  const width = widthOverride || Math.max(68, Math.min(terminalCols, 96));
  const contentWidth = Math.max(0, width - 4 - CONTENT_MARGIN * 2);

  const primary = color.cyan(header);
  const secondary = fullName ? color.dim(fullName) : null;
  const tagline = profile.bio ? color.italic(`"${profile.bio}"`) : null;
  const aboutLines = about ? wrapText(about, contentWidth, 0) : [];
  const quoteLines = finalQuote ? wrapText(`"${finalQuote}"`, contentWidth, 0) : [];

  const githubUrl = `https://github.com/${profile.username || "zephinax"}`;

  const lines = [
    boxTop("Profile", width),
    boxLine(primary, width),
    secondary ? boxLine(secondary, width) : null,
    tagline ? boxLine(tagline, width) : null,
    boxDivider("details", width),
    fieldLine("Role", profile.jobTitle, width),
    fieldLine("Location", profile.address, width),
    fieldLine("Timezone", profile.timeZone, width),
    boxDivider("contact", width),
    fieldLine("Web", profile.website, width, profile.website),
    fieldLine("GitHub", githubUrl, width, githubUrl),
    fieldLine("Email", profile.email, width, profile.email ? `mailto:${profile.email}` : null),
    boxDivider("skills", width),
    ...Object.entries(skills).map(([key, val]) => fieldLine(key, val, width)),
    aboutLines.length ? boxDivider("about", width) : null,
    ...aboutLines.map((l) => boxLine(l, width)),
    quoteLines.length ? boxDivider("philosophy", width) : null,
    ...quoteLines.map((l) => boxLine(color.italic(l), width)),
    boxBottom(width)
  ].filter(Boolean);

  return lines.join("\n");
}

function renderPlain(profile) {
  const { about, quote } = parseAboutAndQuote(profile.about);
  const finalQuote = profile.quote || quote;
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  const skills = profile.skills || DEFAULT_SKILLS;
  const githubUrl = `https://github.com/${profile.username || "zephinax"}`;

  const lines = [
    `${profile.displayName || profile.username || "Zephinax"}${profile.pronouns ? ` (${profile.pronouns})` : ""}`,
    fullName || null,
    profile.bio ? `"${profile.bio}"` : null,
    "",
    "--- DETAILS ---",
    profile.jobTitle ? `Role:     ${profile.jobTitle}` : null,
    profile.address ? `Location: ${profile.address}` : null,
    profile.timeZone ? `Timezone: ${profile.timeZone}` : null,
    "",
    "--- CONTACT ---",
    profile.website ? `Web:      ${profile.website}` : null,
    `GitHub:   ${githubUrl}`,
    profile.email ? `Email:    ${profile.email}` : null,
    "",
    "--- SKILLS ---",
    ...Object.entries(skills).map(([key, val]) => `${(key + ":").padEnd(10)} ${val}`),
    "",
    about ? "--- ABOUT ---" : null,
    about || null,
    "",
    finalQuote ? "--- PHILOSOPHY ---" : null,
    finalQuote ? `"${finalQuote}"` : null
  ].filter((l) => l !== null);

  return lines.join("\n");
}

function openUrl(url) {
  const platform = process.platform;
  let cmd;
  if (platform === "darwin") {
    cmd = `open "${url}"`;
  } else if (platform === "win32") {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, () => {});
}

function copyToClipboard(text) {
  const platform = process.platform;
  try {
    if (platform === "darwin") {
      spawnSync("pbcopy", { input: text });
      return true;
    } else if (platform === "win32") {
      spawnSync("clip", { input: text });
      return true;
    } else {
      const resXclip = spawnSync("which", ["xclip"]);
      if (resXclip.status === 0) {
        spawnSync("xclip", ["-selection", "clipboard"], { input: text });
        return true;
      }
      const resWl = spawnSync("which", ["wl-copy"]);
      if (resWl.status === 0) {
        spawnSync("wl-copy", { input: text });
        return true;
      }
      return false;
    }
  } catch {
    return false;
  }
}

function runInteractive(profile) {
  return new Promise((resolve) => {
    const email = profile.email || "zephinax@gmail.com";
    const web = profile.website || "https://zephinax.com";
    const github = `https://github.com/${profile.username || "zephinax"}`;

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log("\n" + color.bold(color.cyan("Actions:")));
    console.log(`  ${color.yellow("[1]")} 🌐 Open Website  ${color.dim(`(${web})`)}`);
    console.log(`  ${color.yellow("[2]")} 🐙 Open GitHub   ${color.dim(`(${github})`)}`);
    console.log(`  ${color.yellow("[3]")} ✉️  Send Email    ${color.dim(`(${email})`)}`);
    console.log(`  ${color.yellow("[4]")} 📋 Copy Email    ${color.dim(`(${email})`)}`);
    console.log(`  ${color.yellow("[q]")} 🚪 Exit\n`);

    const ask = () => {
      rl.question(color.cyan("Select an option (1-4, or press Enter/q to exit): "), (answer) => {
        const choice = answer.trim().toLowerCase();
        switch (choice) {
          case "1":
            console.log(color.dim(`Opening ${web}...`));
            openUrl(web);
            ask();
            break;
          case "2":
            console.log(color.dim(`Opening ${github}...`));
            openUrl(github);
            ask();
            break;
          case "3":
            console.log(color.dim(`Opening email client...`));
            openUrl(`mailto:${email}`);
            ask();
            break;
          case "4": {
            const ok = copyToClipboard(email);
            if (ok) {
              console.log(color.green(`✓ Email copied to clipboard!`));
            } else {
              console.log(color.yellow(`Clipboard unavailable. Email: ${email}`));
            }
            ask();
            break;
          }
          case "":
          case "q":
          case "quit":
          case "exit":
            console.log(color.dim("Thanks for stopping by!"));
            rl.close();
            resolve();
            break;
          default:
            console.log(color.magenta("Invalid option. Please enter 1, 2, 3, 4, or q."));
            ask();
            break;
        }
      });
    };

    rl.on("close", resolve);
    ask();
  });
}

async function fetchProfile(url, timeoutMs = 3000) {
  let controller;
  let timeoutId;
  if (typeof AbortController !== "undefined") {
    controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    if (typeof fetch === "function") {
      const res = await fetch(url, {
        signal: controller ? controller.signal : undefined,
        headers: { "User-Agent": "zephinax-cli-cv" }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return { profile: json.data || json, fromNetwork: true };
    }

    return await new Promise((resolve, reject) => {
      const req = https.get(url, { timeout: timeoutMs }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`HTTP ${res.statusCode}`));
          }
          try {
            const json = JSON.parse(data);
            resolve({ profile: json.data || json, fromNetwork: true });
          } catch (err) {
            reject(err);
          }
        });
      });
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timed out"));
      });
    });
  } catch (err) {
    return { profile: FALLBACK_PROFILE, fromNetwork: false, error: err.message };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function showHelp() {
  console.log(`
${color.bold("Zephinax (Amirali Rajabi)")} - CLI Portfolio & CV

${color.yellow("Usage:")}
  npx zephinax [options]

${color.yellow("Options:")}
  -s, --static         Print card without interactive action prompt
  -j, --json           Output profile data in raw JSON format
  -p, --plain          Output clean plain text without borders or ANSI colors
      --offline        Use embedded profile data without making network requests
  -h, --help           Show this help message
  -v, --version        Show version number
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("-h") || args.includes("--help")) {
    showHelp();
    return;
  }

  if (args.includes("-v") || args.includes("--version")) {
    console.log(PKG.version);
    return;
  }

  const isJson = args.includes("-j") || args.includes("--json");
  const isPlain = args.includes("-p") || args.includes("--plain");
  const isOffline = args.includes("--offline");
  const isStatic =
    args.includes("-s") ||
    args.includes("--static") ||
    args.includes("--no-interactive");

  let profile;
  let fromNetwork = false;

  if (isOffline) {
    profile = FALLBACK_PROFILE;
  } else {
    const res = await fetchProfile(API_URL);
    profile = { ...FALLBACK_PROFILE, ...res.profile };
    fromNetwork = res.fromNetwork;
  }

  if (isJson) {
    const { about, quote } = parseAboutAndQuote(profile.about);
    console.log(
      JSON.stringify(
        {
          ...profile,
          skills: profile.skills || DEFAULT_SKILLS,
          quote: profile.quote || quote,
          about: about || profile.about,
          source: fromNetwork ? "network" : "offline_cache"
        },
        null,
        2
      )
    );
    return;
  }

  if (isPlain) {
    console.log(renderPlain(profile));
    return;
  }

  console.log(render(profile));

  const isInteractiveTerminal = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (isInteractiveTerminal && !isStatic) {
    await runInteractive(profile);
  }
}

main();
