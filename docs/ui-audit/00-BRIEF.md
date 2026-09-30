# UI/UX audit brief — Hardware Khata POS (read this first)

You are reviewing ONE group of screens of an offline shop POS (Electron + React +
Tailwind). Repo: /home/shahriar/Desktop/Projects/Hardware-Khata-POS (frontend in `src/`).
This is ANALYSIS ONLY. Do NOT edit any file in the repo. Write your findings to the
single output file named in your task.

## Who uses it
- An ELDERLY shop owner and his cashiers in Bangladesh. Bangla-first (the UI has an
  English/Bangla toggle; Bangla is applied by translating whole text nodes).
- Windows 7 PC (Electron 22), mouse + keyboard, screen usually 1366×768 (sometimes
  1920×1080). Long days at the counter → eye comfort matters. Dark theme is the
  default look; light theme exists.
- Goal of this work: make every screen easier, calmer and more readable; remove
  clutter/duplication; right-size text, inputs, buttons, tables, popups.

## Screenshots (real app, demo data, 1366×768)
- English, dark: /tmp/hk-ui-shots/NN-<route>.png
- Bangla, dark:  /tmp/hk-ui-shots-bn/NN-<route>.png (same numbering as English)
- English, light: /tmp/hk-ui-shots-light/ (different numbering — `ls` and match the route slug; not every route has one)
View them with your file-reading tool (it shows images). Look at EVERY English
screenshot in your group, and the Bangla one for each screen too (Bangla text is
longer and wraps differently). Light theme: check at least the ones that exist.
Screenshots show only the first viewport; read the code for what is below the fold,
and for modals/drawers/popovers (no screenshots of those).

## The design scale in this codebase (already bumped for older eyes)
Tailwind config (`tailwind.config.js`) font sizes: `text-2xs`=12px, `text-xs`=14px,
`text-sm`=16px, `text-base`=17px, `text-lg`=19px, `text-xl`=21px, `text-2xl`=25px.
Arbitrary sizes like `text-[10px]` / `text-[11px]` / `text-[9px]` BYPASS that scale
(and ignore the font-scale slider in Settings → Appearance). There are ~560 of them.
Heights: `h-7`=28px, `h-8`=32px, `h-9`=36px, `h-10`=40px, `h-11`=44px; `size-7`=28px.
Primitives: `src/components/ui/` — Button (sm=h-7, md=h-9, lg=h-11, icon=size-9),
Input (h-9), Modal (backdrop click closes, no focus trap, no initial focus,
close X size-8), Drawer (same), PageHeader, Card. Many pages define their own local
`Field` and raw `<select>` with hand-copied classes.

## The target standard (judge against this; recommend changes toward it)
1. Readable text: nothing below 14px (`text-xs`) that a user must read; body, table
   cells, inputs and buttons 16px (`text-sm`); page titles 21–25px. No uppercase
   micro-labels (`text-[10px] uppercase`) — sentence-case 14px labels instead
   (uppercase means nothing in Bangla and is harder to read in English).
2. Targets: primary buttons and inputs 40px (`h-10`); big money/confirm actions 44–48px;
   icon buttons ≥ 36px (`size-9`), row actions ≥ 32px with a visible label or tooltip.
3. Forms: label above the field, 14px medium, sentence case; required marked clearly;
   one column on narrow widths; related fields grouped; sensible defaults; Enter submits;
   the first field focused; errors shown next to the field in plain words.
4. Popups (Modal/Drawer): width fits the content (no huge empty modals), height ≤ 90vh
   with the footer always visible; primary action bottom-right, Cancel next to it;
   do not close on a stray backdrop click when the user has typed something; Esc closes;
   title says what happens ("Receive payment from Rahim"), not a code.
5. One clear primary action per screen; destructive actions visually separated.
6. Tables: row height ≥ 44px, header 14px normal case, money right-aligned with
   tabular digits, status as a readable badge, the important column first; avoid
   more than ~7 visible columns at 1366px; horizontal scroll only as a last resort.
7. Calm screens: no duplicate numbers/buttons saying the same thing; no decorative
   noise that competes with data; progressive disclosure for expert options;
   empty states that say what to do next.
8. Colour & contrast: text contrast ≥ 4.5:1 in both themes; colour never the only
   signal; loud colour reserved for money-state and warnings.
9. Bangla: labels must fit when translated (no clipped/truncated Bangla); avoid
   interpolated sentences that cannot be translated; numbers stay legible.
10. Layout at 1366×768: nothing important below the fold on the main task screens;
    no horizontal overflow; the sidebar (≈248px) + page must work together.

## Output format (Markdown, in your output file)
For EACH screen in your group, in this exact shape:

### <Screen name> — `<route>` (screenshot NN)
**Purpose:** one line.
**Works well:** 1–3 bullets (keep what is good).
**Problems:** numbered list. Each item: `[High|Med|Low]` + what is wrong + WHERE
(file:line or the screenshot region) + the concrete fix (exact class/size/copy changes,
what to move/merge/remove).
**Remove / merge:** redundant elements to delete or combine (be specific).
**Resize:** exact size changes (e.g. `Button size="sm"` → `md`; `text-[10px] uppercase` → `text-xs`; modal `max-w-3xl` → `max-w-lg`).
**Popups on this screen:** each modal/drawer/popover it opens (component file), with
its own problems and fixes in the same style.
**Bangla:** anything that breaks, clips or stays English.

Then end the file with:
## Cross-cutting patterns seen in this group
Bulleted list of issues that repeat across screens (so they can be fixed once in a
shared component), each with the files involved.

Be concrete and evidence-based (cite files and line numbers). Prefer fewer, sharper
findings over long generic advice. Do not recommend backend changes. Do not pad.
