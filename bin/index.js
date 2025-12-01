#!/usr/bin/env node
"use strict";

const https = require("https");

const API_URL = process.env.ZEPHINAX_API_URL || "https://zephinax.com/api/user";

const color = {
  cyan: (str) => `\x1b[36m${str}\x1b[0m`,
  magenta: (str) => `\x1b[35m${str}\x1b[0m`,
  yellow: (str) => `\x1b[33m${str}\x1b[0m`,
  bold: (str) => `\x1b[1m${str}\x1b[0m`,
  dim: (str) => `\x1b[2m${str}\x1b[0m`
};

async function fetchProfile(url) {
  if (typeof fetch === "function") {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
    return res.json();
  }

  // Fallback for environments without global fetch.
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`Request failed with status ${res.statusCode}`));
          }
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

function clean(text) {
  if (!text) return "";
  return text
    .replace(/\*\*/g, "") // remove bold markers
    .replace(/^>\s?/gm, "") // strip block quotes
    .replace(/\r?\n\s*/g, "\n") // normalize whitespace
    .trim();
}

function line(label, value) {
  return value ? `${color.yellow(label)} ${value}` : null;
}

function wrapText(text, width, indent) {
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
        if (candidate.length > width) {
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
  return char.repeat(length);
}

function stripAnsi(str = "") {
  return str.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ""
  );
}

function visibleLength(str = "") {
  return stripAnsi(str).length;
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
  const inner = Math.max(0, width - 4);
  const content = text || "";
  const visLen = visibleLength(content);
  const needsTruncate = visLen > inner;
  const raw = needsTruncate ? `${stripAnsi(content).slice(0, inner - 1)}…` : content;
  const padding = Math.max(0, inner - visibleLength(raw));
  return `│ ${raw}${" ".repeat(padding)} │`;
}

function boxDivider(label, width) {
  const tag = label ? ` ${label.toUpperCase()} ` : "";
  const lineLen = Math.max(0, width - 2 - tag.length);
  return `├${tag}${divider("─", lineLen)}┤`;
}

function render(profile) {
  const about = clean(profile.about || profile.bio);
  const header =
    `${color.bold(profile.displayName || profile.username || "Zephinax")} ${profile.pronouns ? `(${profile.pronouns})` : ""}`.trim();
  const fullName =
    profile.firstName || profile.lastName
      ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
      : null;

  const width = Math.max(60, Math.min(process.stdout.columns || 80, 100));
  const inner = Math.max(0, width - 4);

  const primary = color.cyan(header);
  const secondary = fullName ? color.dim(fullName) : null;
  const roleLocation = [profile.jobTitle, profile.timeZone].filter(Boolean).join("  •  ");
  const contact = [profile.email, profile.website].filter(Boolean).join("  •  ");
  const aboutLines = about ? wrapText(about, inner - 2, 0) : [];

  const lines = [
    boxTop("Profile", width),
    boxLine(primary, width),
    secondary ? boxLine(secondary, width) : null,
    roleLocation ? boxLine(roleLocation, width) : null,
    contact ? boxLine(contact, width) : null,
    aboutLines.length ? boxDivider("about", width) : null,
    ...aboutLines.map((l) => boxLine(l, width)),
    boxBottom(width)
  ].filter(Boolean);

  return lines.join("\n");
}

async function main() {
  try {
    const data = await fetchProfile(API_URL);
    if (!data || !data.data) throw new Error("No profile data returned.");
    console.log(render(data.data));
  } catch (err) {
    console.error(`${color.magenta("Error:")} ${err.message}`);
    process.exitCode = 1;
  }
}

main();
