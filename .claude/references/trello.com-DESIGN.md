# Design System Inspired by Atlassian Trello

## 1. Visual Theme & Atmosphere

Trello's design system embodies clarity, efficiency, and approachability through a carefully balanced palette of deep navy foundations and vibrant accent colors. The atmosphere is professional yet inviting, combining minimalist principles with purposeful use of color to guide user attention and create visual hierarchy. The system prioritizes simplicity and scanability, using generous whitespace and restrained typography to reduce cognitive load. Accents like electric blue and vibrant purple are deployed strategically to highlight primary interactions and feature announcements, while the neutral scale grounds the interface in calm sophistication. This design language transforms complex task management into an intuitive, delightful experience that feels both modern and trustworthy.

**Key Characteristics**
- Deep navy (`#091E42`) as the primary structural anchor
- Electric blue (`#1868DB`) for primary actions and high-priority interactions
- Vibrant accent palette (purple, orange) for feature differentiation and secondary call-to-actions
- Generous whitespace and breathing room between components
- Minimalist approach with strategic color emphasis
- Clean, readable typography with balanced contrast
- Emphasis on clarity and task-oriented design
- Accessibility-conscious color choices with high contrast ratios

## 2. Color Palette & Roles

### Primary
- **Navy Deep** (`#091E42`): Primary text color, dominant structural element, navigation items, and foundational UI surfaces. Used extensively throughout the interface as the default text and container backdrop.
- **Navy Medium** (`#172B4D`): Secondary text emphasis, supporting navigation elements, and subtle background differentiation.
- **Navy Light** (`#505F79`): Tertiary text, disabled states, placeholder text, and subtle UI dividers.

### Accent Colors
- **Electric Blue** (`#1868DB`): Primary call-to-action buttons, highlighted features, and primary interactive states. High emphasis for sign-up flows and main product actions.
- **Blue Bright** (`#357DE8`): Hover and active states for primary interactive elements, enhanced visibility on secondary actions.
- **Blue Dark** (`#1558BC`): Pressed states and visited link indicators, deepens interactive feedback.
- **Purple Vibrant** (`#A855F7`): Featured secondary actions, board headers, and accent containers for feature promotion (Boards, Planner sections).
- **Cyan Bright** (`#06B6D4`): Accent strokes, dividers, and highlight accents (Inbox left border indicator).

### Interactive
- **Error/Danger** (`#C9372C`): Error messages, validation states, destructive action warnings, and critical alerts.
- **Success/Green** (`#4C6B1F`): Positive action states, completion indicators, and successful validation messages.
- **Light Error Background** (`#FFD5D2`): Subtle error message backgrounds and light error state containers.

### Neutral Scale
- **White** (`#FFFFFF`): Primary background surfaces, card backgrounds, and default container fills.
- **Off-White** (`#F1F2F4`): Secondary background, subtle section differentiation, and hover states.
- **Light Gray** (`#DCDFE4`): Disabled text, secondary borders, and subtle dividers.
- **Gray Border** (`#DDDEE1`): Input field borders, light container outlines, and subtle separators.
- **Medium Gray** (`#A9ABAF`): Tertiary text, muted labels, and icon secondary states.
- **Dark Gray** (`#505258`): Secondary body text and muted information.
- **Nearly Black** (`#1E1F21`): Emphasized text, strong contrast captions, and deep shadows.
- **Black** (`#000000`): Maximum contrast text and stark dividers where highest readability is required.

### Surface & Borders
- **Surface Primary** (`#FFFFFF`): Default card and panel backgrounds.
- **Surface Secondary** (`#F1F2F4`): Alternate section backgrounds and subtle depth differentiation.
- **Border Light** (`#DDDEE1`): Soft input borders, subtle container edges, and minimal visual weight.
- **Border Medium** (`#DCDFE4`): Standard component borders, form field outlines, and container separation.

## 3. Typography Rules

### Font Family

**Primary:** Charlie Display (serif system font stack)
Fallback: `'Charlie Display', Georgia, 'Times New Roman', serif`

**Secondary:** Charlie Text (sans-serif system font stack)
Fallback: `'Charlie Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif`

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|-----------------|-------|
| **Display / H1** | Charlie Display | 48px | 500 | 60px | 0px | Hero headlines, page titles, primary messaging |
| **Heading 2 / H2** | Charlie Text | 16px | 500 | 21.33px | 0px | Section headers, feature titles, card headers |
| **Heading 3 / H3** | Charlie Display | 24px | 500 | 32px | 0px | Feature section titles, prominent subsections |
| **Heading 4 / H4** | Charlie Display | 20px | 500 | 24px | 0px | Card titles, modal headers, emphasis headers |
| **Body / Standard** | Charlie Text | 16px | 400 | 24px | 0px | Paragraph text, descriptions, body copy |
| **Body Large** | Charlie Text | 20px | 400 | 30px | 0px | List items, navigation items, large body text |
| **Button** | Charlie Text | 16px | 400 | 24px | 0px | Interactive button text and labels |
| **Label / Caption** | Charlie Text | 16px | 600 | normal | 0px | Form labels, strong callouts, badge text |
| **Subtitle** | Charlie Text | 16px | 400 | 24px | 0px | Secondary headings, descriptions under titles |
| **Code / Monospace** | Menlo, Monaco, 'Courier New', monospace | 14px | 400 | 21px | 0px | Code blocks, technical content (system default) |

### Principles
- **Hierarchy through Weight:** Primary differentiation uses font weight (400 for body, 500–600 for headings/labels) rather than excessive size variation.
- **Generous Line Height:** Minimum `1.5x` font size ensures comfortable readability and breathing room, critical for productivity tools.
- **Size Restraint:** Limited to three primary sizes (16px, 20px, 24px, 48px) to maintain rhythm and predictability.
- **High Contrast:** Headings use Navy Deep (`#091E42`) on white for maximum scanability; body uses the same for consistency.
- **Semantic Weights:** 400 for information, 500–600 for emphasis and interactive elements, creating clear visual hierarchy.

## 4. Component Stylings

### Buttons

#### Primary Button (CTA)
- **Background:** `#1868DB`
- **Text Color:** `#FFFFFF`
- **Font Size:** `16px`
- **Font Weight:** `400`
- **Font Family:** Charlie Text
- **Padding:** `8px 20px`
- **Border Radius:** `4.8px`
- **Border:** `none`
- **Line Height:** `24px`
- **Min Height:** `40px`
- **Box Shadow:** `rgba(9, 30, 66, 0.15) 0px 8px 16px 0px`
- **Hover State:** Background `#357DE8`, shadow intensifies
- **Active State:** Background `#1558BC`
- **Disabled State:** Background `#DCDFE4`, text color `#A9ABAF`

#### Secondary Button
- **Background:** `#FFFFFF`
- **Text Color:** `#172B4D`
- **Font Size:** `16px`
- **Font Weight:** `400`
- **Font Family:** Charlie Text
- **Padding:** `8px 20px`
- **Border Radius:** `4.8px`
- **Border:** `1px solid #172B4D`
- **Line Height:** `24px`
- **Min Height:** `40px`
- **Box Shadow:** `none`
- **Hover State:** Background `#F1F2F4`, border color `#172B4D`
- **Active State:** Background `#DCDFE4`, border darkens to `#091E42`
- **Disabled State:** Background `#F1F2F4`, text color `#A9ABAF`, border color `#DCDFE4`

#### Ghost Button
- **Background:** `transparent`
- **Text Color:** `#172B4D`
- **Font Size:** `16px`
- **Font Weight:** `400`
- **Font Family:** Charlie Text
- **Padding:** `8px 16px`
- **Border Radius:** `4px`
- **Border:** `none`
- **Line Height:** `24px`
- **Min Height:** `40px`
- **Box Shadow:** `none`
- **Hover State:** Background `#F1F2F4`
- **Active State:** Background `#DCDFE4`
- **Disabled State:** Text color `#A9ABAF`

#### Icon Button (Minimal)
- **Background:** `transparent`
- **Text Color:** `#091E42`
- **Padding:** `4px`
- **Border Radius:** `4px`
- **Border:** `none`
- **Line Height:** `24px`
- **Size:** `32px × 32px` (icon centered)
- **Hover State:** Background `#F1F2F4`
- **Active State:** Background `#DCDFE4`

### Cards & Containers

#### Standard Card
- **Background:** `#FFFFFF`
- **Border:** `1px solid #DDDEE1`
- **Border Radius:** `4px`
- **Padding:** `24px`
- **Box Shadow:** `rgba(9, 30, 66, 0.13) 0px 1px 1px 0px`
- **Text Color:** `#091E42`

#### Feature Card (Boards/Planner)
- **Background:** Linear gradient or solid `#A855F7` (purple) or `#1868DB` (blue)
- **Border:** `none`
- **Border Radius:** `8px`
- **Padding:** `24px`
- **Box Shadow:** `rgba(9, 30, 66, 0.15) 0px 8px 16px 0px`
- **Text Color:** `#FFFFFF`
- **Heading Color:** `#FFFFFF`

#### Container (Section Wrapper)
- **Background:** `#F1F2F4`
- **Border:** `none`
- **Border Radius:** `0px` (full-width sections) or `8px` (component containers)
- **Padding:** `32px 24px`
- **Text Color:** `#091E42`

#### Divider / Accent Left Border
- **Border Left:** `4px solid #06B6D4` (cyan accent)
- **Padding Left:** `16px`

### Inputs & Forms

#### Text Input (Default)
- **Background:** `#FFFFFF`
- **Text Color:** `#000000`
- **Border:** `1px solid #DDDEE1`
- **Border Radius:** `4.8px`
- **Padding:** `12px`
- **Font Size:** `16px`
- **Font Weight:** `400`
- **Font Family:** Charlie Text
- **Line Height:** `24px`
- **Min Height:** `44px`
- **Placeholder Color:** `#A9ABAF`
- **Focus State:** Border color `#1868DB`, box-shadow `0px 0px 0px 3px rgba(24, 104, 219, 0.15)`
- **Error State:** Border color `#C9372C`, background `#FFF5F4`
- **Disabled State:** Background `#F1F2F4`, text color `#A9ABAF`, border color `#DCDFE4`

#### Email Input
- **Extends:** Text Input
- **Border Radius:** `50px`
- **Padding:** `16px 20px`
- **Min Height:** `48px`

#### Select / Dropdown
- **Background:** `#FFFFFF`
- **Text Color:** `#091E42`
- **Border:** `1px solid #DDDEE1`
- **Border Radius:** `4.8px`
- **Padding:** `12px 16px`
- **Font Size:** `16px`
- **Line Height:** `24px`
- **Focus State:** Border color `#1868DB`
- **Hover State:** Background `#F1F2F4`

#### Checkbox / Radio
- **Border Radius:** `2px` (checkbox) or `50%` (radio)
- **Size:** `20px × 20px`
- **Border:** `2px solid #DCDFE4`
- **Checked Background:** `#1868DB`
- **Checked Border:** `#1868DB`
- **Checked Icon Color:** `#FFFFFF`

### Navigation

#### Header Navigation
- **Background:** `#FFFFFF`
- **Text Color:** `#091E42`
- **Font Size:** `16px`
- **Font Weight:** `400`
- **Font Family:** Charlie Text
- **Padding:** `16px 24px`
- **Hover State:** Text color `#1868DB`, background `transparent`
- **Active State:** Text color `#1868DB`, border-bottom `2px solid #1868DB`

#### Dropdown Menu (Navigation)
- **Background:** `#FFFFFF`
- **Border:** `1px solid #DCDFE4`
- **Border Radius:** `4px`
- **Box Shadow:** `rgba(9, 30, 66, 0.25) 0px 4px 12px 0px`
- **Item Padding:** `12px 16px`
- **Item Hover:** Background `#F1F2F4`
- **Item Text Color:** `#091E42`
- **Item Font Size:** `14px`

#### Breadcrumb Navigation
- **Text Color:** `#505F79`
- **Font Size:** `14px`
- **Separator:** `/` in `#A9ABAF`
- **Active Item:** Color `#091E42`, font-weight `500`
- **Link Hover:** Color `#1868DB`

### Links

#### Inline Link
- **Text Color:** `#1868DB`
- **Text Decoration:** `none`
- **Font Weight:** `400`
- **Font Size:** `16px`
- **Hover State:** Text decoration `underline`, color `#357DE8`
- **Active State:** Color `#1558BC`
- **Visited State:** Color `#172B4D`

#### Link Button (Secondary)
- **Extends:** Secondary Button styles
- **Padding:** `8px 12px`
- **Font Size:** `14px`

### Badges & Tags

#### Default Badge
- **Background:** `#F1F2F4`
- **Text Color:** `#091E42`
- **Border Radius:** `2px`
- **Padding:** `4px 8px`
- **Font Size:** `12px`
- **Font Weight:** `500`
- **Border:** `1px solid #DCDFE4`

#### Success Badge
- **Background:** `#E8F5E9`
- **Text Color:** `#4C6B1F`
- **Border:** `1px solid #4C6B1F`

#### Error Badge
- **Background:** `#FFF5F4`
- **Text Color:** `#C9372C`
- **Border:** `1px solid #C9372C`

#### Primary Badge
- **Background:** `#E0ECFF`
- **Text Color:** `#1868DB`
- **Border:** `1px solid #1868DB`

### Modals & Overlays

#### Modal Container
- **Background:** `#FFFFFF`
- **Border Radius:** `8px`
- **Box Shadow:** `rgba(9, 30, 66, 0.47) 0px 8px 16px 0px`
- **Padding:** `32px`
- **Max Width:** `500px`

#### Modal Header
- **Border Bottom:** `1px solid #DCDFE4`
- **Padding Bottom:** `16px`
- **Margin Bottom:** `16px`
- **Font Size:** `20px`
- **Font Weight:** `500`

#### Modal Backdrop
- **Background:** `rgba(9, 30, 66, 0.54)`

## 5. Layout Principles

### Spacing System

**Base Unit:** `4px`

**Scale & Usage:**
- `4px` — Micro spacing (tight padding within inline elements, small gaps between inline items)
- `8px` — Compact spacing (button padding, small component gaps)
- `12px` — Standard tight spacing (form field padding, icon spacing)
- `16px` — Standard spacing (padding in cards, navigation items, component interior spacing)
- `24px` — Generous spacing (card padding, section padding, margin between content blocks)
- `32px` — Large spacing (section padding, major content separation)
- `52px` — Extra large spacing (feature section vertical gaps, hero section spacing)
- `60px` — XL spacing (page-level vertical rhythm, major section separation)
- `76px` — Maximum spacing (hero section bottom margin, full-page rhythm)

**Context Application:**
- Form fields and buttons: `8px–12px` internal padding
- Card content: `24px` padding
- Section containers: `32px–52px` padding
- Hero sections: `60px–76px` margin
- Between sections: `32px–60px` gap

### Grid & Container

**Max Container Width:** `1280px` (desktop standard)

**Column Strategy:** 
- Desktop (12-column grid, 8px gutter)
- Tablet (6-column grid, 8px gutter)
- Mobile (4-column grid, 8px gutter)

**Section Patterns:**
- **Full-width hero:** No max width constraint, padding `76px 24px` (vertical × horizontal)
- **Contained section:** Max width `1280px`, centered, padding `52px 24px`
- **Asymmetric layouts:** Left column `40%` / Right column `60%` with `32px` gap

**Breakpoint Container Adjustments:**
- Desktop (1280px+): Full width with side margins
- Tablet (768px–1279px): 90% width, centered
- Mobile (320px–767px): Full width with `16px` horizontal padding

### Whitespace Philosophy

Trello's layout embraces **strategic breathing room** to enhance clarity and reduce cognitive load. Large whitespace (`32px–76px`) separates major concept groups, allowing users to process information in digestible chunks. Medium whitespace (`16px–24px`) organizes related components, while tight spacing (`4px–8px`) groups tightly related elements (button groups, inline controls). The philosophy emphasizes that whitespace is not "empty"—it's an active design tool that guides the eye and creates visual hierarchy. Avoid cramping elements; generous margins create a sense of calm and professionalism essential for productivity tools.

### Border Radius Scale

- `2px` — Badges, small elements, tight corners
- `4px` — Buttons (secondary), inputs, cards, standard UI components
- `4.8px` — Primary buttons, form inputs with emphasis
- `8px` — Feature cards, modal containers, larger components
- `50px` — Rounded pill inputs (email signup fields), extreme emphasis
- `0px` — Full-width sections, dividers, structural elements without visual softness

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| **Flat / No Elevation** | `box-shadow: none` | Default backgrounds, cards on white surface, structural containers |
| **Subtle** | `box-shadow: rgba(9, 30, 66, 0.13) 0px 1px 1px 0px` | Standard cards, secondary containers, minimal depth |
| **Base Elevation** | `box-shadow: rgba(9, 30, 66, 0.15) 0px 8px 16px 0px` | Buttons, interactive primary elements, hovered cards |
| **Hover State** | `box-shadow: rgba(9, 30, 66, 0.20) 0px 12px 24px 0px` | Elevated cards on hover, expanded modals, interactive feedback |
| **Modal / Overlay** | `box-shadow: rgba(9, 30, 66, 0.47) 0px 8px 16px 0px` | Modals, dropdowns, popovers, highest interactive layer |
| **Dropdown Menu** | `box-shadow: rgba(9, 30, 66, 0.25) 0px 4px 12px 0px` | Navigation dropdowns, context menus, floating elements |

**Shadow Philosophy:** Trello uses measured elevation to create subtle depth without visual heaviness. Shadows are built with low opacity (`0.13–0.47`) and soft blur (`8px–24px`) to maintain sophistication. Primary emphasis comes through color, not shadow — shadows serve as confirmation of interactive state or layer separation. Dark navy tint (`9, 30, 66`) ensures shadows harmonize with the brand color system and feel cohesive across light backgrounds.

## 7. Do's and Don'ts

### Do

- **Use Navy Deep (`#091E42`) as your anchor** for text, structure, and default states to maintain visual consistency and brand recognition.
- **Reserve Electric Blue (`#1868DB`) exclusively for primary actions** (CTAs, sign-up buttons) to maintain clarity and prevent interaction confusion.
- **Apply generous padding (`16px–24px`) to cards and containers** to create breathing room and reduce visual overwhelm.
- **Maintain minimum touch target size of `44px × 44px`** for mobile interactions to ensure accessibility and usability.
- **Stack elements vertically with `24px–32px` gaps** between major sections to guide the eye and establish clear information hierarchy.
- **Use Charlie Display for display/hero text** to create personality and visual emphasis; reserve Charlie Text for everything else.
- **Implement focus states with `3px` colored border** and subtle shadow (`rgba(24, 104, 219, 0.15)`) for keyboard accessibility.
- **Layer accent colors (purple, cyan) strategically** to highlight secondary features or create visual distinction without competing with primary actions.
- **Test all color combinations for WCAG AA contrast** minimum (`4.5:1` for text, `3:1` for UI components) to ensure accessibility.
- **Use modals sparingly with `#FFFFFF` backgrounds** and strong shadow elevation (`0px 8px 16px`) to establish clear modal hierarchy.

### Don't

- **Don't use Navy Medium or Navy Light (`#172B4D`, `#505F79`) for critical interactive elements** — reserve Electric Blue for highest priority actions only.
- **Don't apply shadows to elements on colored backgrounds** — shadows become muddy and reduce visual clarity; use solid containers instead.
- **Don't exceed `3px` border radius on standard buttons** — maintain sharpness and modern aesthetic; only soften pill-shaped inputs to `50px`.
- **Don't mix more than two secondary accent colors in a single section** — restrict to purple and cyan; more creates visual noise.
- **Don't underline text links on hover alone** — always change color to Electric Blue first; underline is reinforcement, not the primary indicator.
- **Don't use color to convey meaning without supporting text or icons** — ensure red errors, green success, etc., have accompanying labels.
- **Don't create buttons smaller than `40px` height or `32px` minimum width** — violates touch target standards and feels cramped.
- **Don't set font sizes smaller than `14px` for body text** — diminishes readability and creates accessibility issues on small screens.
- **Don't apply padding less than `8px` in interactive elements** — insufficient breathing room creates clickable confusion.
- **Don't use `#000000` pure black for text** — replace with Navy Deep (`#091E42`) for softer, brand-aligned contrast.

## 8. Responsive Behavior

### Breakpoints

| Breakpoint Name | Min Width | Max Width | Key Changes | Grid Columns |
|---|---|---|---|---|
| **Mobile** | 320px | 767px | Single column, full-width sections, stacked navigation, `12px` padding sides, smaller typography (16px bodies), buttons full-width or `48px` height, reduced icon sizes | 4 |
| **Tablet** | 768px | 1023px | Two-column layout, 6-column grid, sidebar navigation, `24px` padding sides, standard typography, buttons inline, `24px` gaps | 6 |
| **Desktop** | 1024px | 1279px | Three-column layout, 12-column grid, side-by-side feature cards, `32px` padding sides, full hero imagery | 12 |
| **Large Desktop** | 1280px+ | ∞ | Max container width `1280px`, centered layout, enhanced spacing `52px–76px`, feature cards full-width | 12 |

### Touch Targets

**Minimum sizes for mobile interaction:**
- **Buttons:** `44px × 44px` (height × width minimum)
- **Links:** `44px` minimum height with `12px` padding
- **Form inputs:** `48px` minimum height with `12px` internal padding
- **Icon buttons:** `32px × 32px` with `8px` surrounding space (invisible touch area `40px × 40px`)
- **Checkboxes / Radio buttons:** `20px × 20px` with `8px` surrounding space
- **Navigation links:** `44px` height, `16px` horizontal padding

**Spacing between touch targets:** Minimum `8px` gap to prevent mis-taps.

### Collapsing Strategy

**Mobile (320px–767px):**
- Full-width sections with `16px` horizontal padding (reserved `24px` mobile padding is used outside component area)
- Hero section: Single-column layout, image below text
- Feature cards: Stack vertically, `16px` gap
- Navigation: Hamburger menu (3-line icon), slide-out drawer
- Form: Single-column layout, full-width inputs
- Buttons: Full-width or `100%` container width (except within button groups, which remain inline with flex wrap)

**Tablet (768px–1023px):**
- Two-column layout emerges for some sections
- Feature cards: 2-column grid with `24px` gap
- Navigation: Top bar with mega-menu support
- Sidebar (if applicable): Collapses to icon-only at `768px`, expands at `1024px`
- Form: Single-column with larger touch targets
- Buttons: Inline by default, wrap on space constraint

**Desktop (1024px+):**
- Three-column or asymmetric layouts available
- Feature cards: Multi-column grid (`1fr 1fr 1fr` or similar)
- Navigation: Full horizontal menu with dropdowns
- Sidebars: Persistent, full-width layout
- Form: Multi-column support, labels beside inputs
- Padding/spacing: Max spacing values (`52px–76px`) applied

**Specific Component Adjustments:**
- **Hero section:** Text wraps to single column below `768px`; hero image hides below `480px` to prioritize text
- **Cards in grid:** Reflow from 3-column to 2-column at `768px`, to 1-column at `480px`
- **Navigation dropdowns:** Convert to bottom sheet on mobile; modal presentation at `< 600px`
- **Modal dialogs:** Full-screen on mobile with `100%` width; max `500px` width on desktop
- **Tables:** Horizontal scroll on mobile, full table on tablet+

## 9. Agent Prompt Guide

### Quick Color Reference

- **Primary CTA Button:** Electric Blue (`#1868DB`)
- **Primary Text / Headings:** Navy Deep (`#091E42`)
- **Secondary Text / Muted:** Navy Light (`#505F79`)
- **Backgrounds:** White (`#FFFFFF`) primary, Off-White (`#F1F2F4`) secondary
- **Borders:** Light Gray (`#DDDEE1`)
- **Accent Left Border:** Cyan Bright (`#06B6D4`)
- **Error State:** Danger Red (`#C9372C`)
- **Success State:** Success Green (`#4C6B1F`)
- **Feature Cards:** Purple Vibrant (`#A855F7`) or Blue (`#1868DB`)
- **Disabled Elements:** Use Light Gray (`#DCDFE4`) background with Medium Gray (`#A9ABAF`) text

### Iteration Guide

1. **Foundation First:** Always set text color to `#091E42` (Navy Deep) and backgrounds to `#FFFFFF` (White) unless explicitly styled as accent or secondary.

2. **Button Priority:** Primary CTAs must be `#1868DB` with `8px 20px` padding and `4.8px` border-radius; secondary buttons are white with navy border; ghosts are transparent with navy text.

3. **Spacing Consistency:** Use the spacing scale (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `52px`, `60px`, `76px`). Never invent intermediate values; snap to scale.

4. **Typography Adherence:** Limit to Charlie Display (headings, 48px / 24px / 20px) and Charlie Text (body, 16px / 20px). Font weights: `400` for body, `500–600` for headings/labels. Never use sizes outside the hierarchy table.

5. **Elevation & Shadow:** Apply `rgba(9, 30, 66, 0.15) 0px 8px 16px 0px` to buttons and base cards. Reserve heavier shadows (`0px 8px 16px` with `0.47` opacity) for modals only. Flat elements have no shadow.

6. **Border Radius Rules:** Buttons and inputs use `4.8px` or `4px`; cards and containers use `4px` or `8px`; pill inputs use `50px`; badges use `2px`. Never exceed `8px` for standard components.

7. **Focus & Accessibility:** All interactive elements need focus states: `3px solid #1868DB` border or `0px 0px 0px 3px rgba(24, 104, 219, 0.15)` shadow. Ensure `4.5:1` contrast for text on background.

8. **Responsive Collapse:** Default to single-column mobile (full width, `16px` padding), shift to multi-column at `768px` breakpoint. Touch targets minimum `44px`. Test all components at `320px`, `768px`, and `1280px` widths.

9. **Color Meaning:** Electric Blue (`#1868DB`) for primary actions only; Red (`#C9372C`) for errors and destructive actions; Green (`#4C6B1F`) for success; Gray (`#A9ABAF`) for disabled. Never flip meanings; consistency is critical for user trust.

10. **Component Variants:** Every button has default, hover, active, and disabled states. Inputs have default, focus (border color `#1868DB` + shadow), error (border `#C9372C` + light red background), and disabled (light gray bg + muted text). Build all four states.