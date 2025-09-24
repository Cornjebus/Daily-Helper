# UI/UX Design Document

## 1. Introduction

This document outlines the user interface (UI) and user experience (UX) design for the **AI for Daily Life — Unified Focus Assistant**. The design is based on the brand style of rallyinnovation.com, with a focus on a dark, high-contrast, and modern aesthetic.

## 2. UI/Brand Style — RallyInnovation.com

### 2.1. Reference Cues

*   **Theme**: Dark, high-contrast hero sections.
*   **Typography**: Massive typographic hierarchy with oversized headings.
*   **Data Display**: Stat blocks with large numerals for emphasis.
*   **Calls to Action (CTAs)**: Pill-shaped buttons.
*   **Navigation**: Simple, uppercase navigation elements.

### 2.2. Typography

*   **Font Family**: Inter, Geist, or Plus Jakarta Sans (bold, wide sans-serif).
*   **Headings (H1)**: Oversized with tight line height.
*   **Numeric Stats**: Emphasized for impact.

### 2.3. Color Palette

*   **Primary Background**: Near-black (`#000000`)
*   **Primary Text**: Off-white (`#FDFDFD`)
*   **Secondary Text/Borders**: Mid-gray (`#A1A1A1`)
*   **Muted Text**: Muted gray (`#5A5A5A`)

### 2.4. Components (shadcn/ui)

*   **Button**: `rounded-full`
*   **Card**: Standard card component for displaying feed items.
*   **Tabs**: For "Now," "Next," and "Later" sections.
*   **DropdownMenu**: For one-click actions on feed items.
*   **Badge**: For displaying item source (Gmail, Slack, etc.).
*   **Alert**: For notifications and alerts.
*   **Toast**: For temporary feedback messages.

### 2.5. Motion

*   **Hero/Cards**: Subtle fade and slide-up animations on load.

## 3. Screen Inventory

*   **Login/Signup Page**: Simple form for authentication.
*   **Dashboard (Focus Feed)**: Main screen with the prioritized feed.
*   **Settings Page**: For managing connections and preferences.

## 4. UI Mockups

The following high-fidelity mockups demonstrate the visual design implementation:

*   **[Dashboard Mockup](mockup_dashboard.png)**: Shows the main interface with the three-tab layout ("Now," "Next," "Later"), sidebar navigation, and prioritized feed cards with source badges and action menus.
*   **[Login Screen Mockup](mockup_login.png)**: Displays the authentication interface with connection buttons for Gmail, Slack, and Google Calendar.
*   **[Settings Page Mockup](mockup_settings.png)**: Illustrates the configuration interface for connected accounts, notification preferences, and AI settings.

## 5. Wireframes

Detailed wireframes for all key screens are provided in **[wireframes.md](wireframes.md)**, including:

*   **Dashboard Layout**: Three-tab interface with prioritized feed cards
*   **Login/Onboarding Flow**: Authentication and account connection process  
*   **Settings Configuration**: Account management and preference controls
*   **Mobile Responsive Design**: Optimized layout for smaller screens
*   **Action Dropdown Menus**: One-click action interfaces

## 6. Accessibility Checklist

*   **Contrast**: All text will have a contrast ratio of at least 4.5:1 against its background.
*   **Focus**: All interactive elements will have a visible focus state.
*   **Reduced Motion**: Animations will be disabled for users who have enabled the `prefers-reduced-motion` media query.

