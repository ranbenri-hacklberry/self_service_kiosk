# iCaffe Kiosk Design System

## 1. Core Principles
- **Flat Design**: Avoid 3D effects, heavy drop shadows, and "beveled" borders.
- **Compactness**: Optimize for single-screen views on iPad/Tablets. Avoid unnecessary scrolling.
- **Touch-First**: Large touch targets (min-height 48px-56px for primary actions).
- **Cleanliness**: Minimal noise, clear hierarchy, whitespace used for grouping.

## 2. Color Palette
### Primary Actions (Add to Cart, Confirm)
- **Background**: Orange (`bg-orange-500`)
- **Hover**: Darker Orange (`hover:bg-orange-600`)
- **Text**: White (`text-white`)

### Secondary Actions (Cancel, Back)
- **Background**: Light Gray (`bg-gray-100` or `bg-gray-200`)
- **Hover**: Medium Gray (`hover:bg-gray-300`)
- **Text**: Dark Gray (`text-gray-800`)

### Special Options (Decaf, Separated)
- **Background**: Purple (`bg-purple-50`)
- **Border**: Purple (`border-purple-200`)
- **Active**: Deep Purple (`bg-purple-600`, `text-white`)

### Text
- **Headings**: `text-gray-800`, `font-black`
- **Body**: `text-gray-700`, `font-bold` (for readability on kiosk)
- **Muted**: `text-gray-500`

## 3. Component Styles

### Buttons
- **Shape**: `rounded-xl` or `rounded-2xl`
- **Style**: Flat (no `border-b-4` for 3D effect).
- **Border**: Thin 1px border for secondary/unselected states (`border-gray-200`).
- **Shadows**: Minimal or none (`shadow-none` or `shadow-sm`).
- **Font**: `font-extrabold` for primary actions, `font-bold` for options.

### Modals
- **Width**: Compact (`max-w-md`) for option selection.
- **Border Radius**: `rounded-3xl`
- **Header**: Simple, contains Image + Title. No close button if "Cancel" exists in footer.
- **Footer**: Sticky bottom, contains primary actions.

### Cards (Menu Items)
- **Shape**: `rounded-2xl`
- **Background**: White
- **Shadow**: Soft shadow (`shadow-sm` or `shadow-md`).

## 4. Layout Patterns
- **Grids**: Use `grid-cols-2` or `grid-cols-3` for options.
- **Spacing**: Consistent padding (`p-4`), gaps (`gap-3` or `gap-4`).
- **RTL**: All interfaces are Right-to-Left (`dir="rtl"`).

## 5. Specific UI Elements
- **Price Display**: Simple text inside buttons (e.g., "₪12"), no background bubbles (`bg-white/20`) unless necessary for contrast.
- **Icons**: Use minimal emoji or SVG icons for quick visual recognition (e.g., 🥛 for milk).
