# Software Requirements Specification (SRS)

## 1. Introduction

This document provides a detailed specification of the **AI for Daily Life — Unified Focus Assistant**. It outlines the functional and non-functional requirements, and serves as a unified guide for the development team, ensuring that all stakeholder needs are met.

## 2. Overall Description

### 2.1. Product Perspective

The Unified Focus Assistant is a web-based application designed to reduce digital debt by consolidating notifications and tasks from Gmail, Slack, and Google Calendar into a single, prioritized feed. It leverages AI to summarize content, extract action items, and score priority, helping users focus on what matters most.

### 2.2. Product Functions

The system will provide the following key functions:

*   **Prioritized Focus Feed**: A unified interface displaying items from connected sources, organized into "Now," "Next," and "Later" categories.
*   **Daily Digest Push**: Automated summaries of key items, decisions, and actions delivered via email or Slack DM three times a day.
*   **One-Click Actions**: The ability to snooze, delegate, schedule, or create tasks directly from the feed.
*   **Data Ingestion**: Securely connect to and ingest data from the Gmail, Google Calendar, and Slack APIs.
*   **AI-Powered Insights**: Utilize the OpenAI API for content summarization, action item extraction, priority scoring, and bundling related items.

### 2.3. User Characteristics

The target users for this application include:

*   **Product Managers (PMs)**: Need a single list of critical tasks to avoid missing deadlines.
*   **Executives (Execs)**: Prefer consolidated digests to minimize interruptions.
*   **Individual Contributors (ICs)**: Want to automatically create tasks from meeting notes and conversations.
*   **Managers**: Require shortcuts for delegating tasks and reassigning work.
*   **Team Members**: Need quick summaries of long threads to catch up efficiently.

### 2.4. Constraints

*   **Technology Stack**: The project must use the specified technologies: Next.js 15.5.3, Node.js 22.x, Supabase, and Vercel.
*   **UI/Brand Style**: The user interface must adhere to the style of rallyinnovation.com.
*   **Data Sources**: The system will exclusively use the Gmail, Google Calendar, and Slack APIs for data ingestion.

## 3. Functional Requirements

| ID | Requirement | User Story Traceability |
|---|---|---|
| FR-1 | The system shall display a prioritized feed of items from Gmail, Slack, and Google Calendar, categorized as "Now," "Next," and "Later." | PM-1, IC-1 |
| FR-2 | The system shall generate and send a daily digest via email and/or Slack DM at 8am, 1pm, and 5pm. | Exec-1 |
| FR-3 | Users shall be able to perform one-click actions on feed items, including "snooze," "delegate," "schedule," and "create task." | Manager-1, IC-1 |
| FR-4 | The system shall securely connect to user accounts for Gmail, Slack, and Google Calendar using OAuth. | - |
| FR-5 | The system shall ingest emails, messages, and calendar events from the connected accounts. | - |
| FR-6 | The system shall use an LLM to summarize conversation threads and documents. | Teammate-1 |
| FR-7 | The system shall use an LLM to extract action items from ingested content. | IC-1 |
| FR-8 | The system shall use an LLM to assign a priority score to each item. | PM-1 |

## 4. Non-Functional Requirements

| ID | Requirement | Description |
|---|---|---|
| NFR-1 | Performance | API endpoints must respond within 500ms. Pages must load within 2 seconds. Digest generation must complete within 5 minutes. |
| NFR-2 | Security | All user data must be encrypted at rest and in transit. Access to the system shall be protected by Supabase Authentication. Secrets will be managed via Vercel Environment Variables. |
| NFR-3 | Usability | The UI must be dark, high-contrast, and follow the style guide of rallyinnovation.com. It should be intuitive and easy to navigate. |
| NFR-4 | Accessibility | The application must meet a minimum contrast ratio of 4.5:1 for text, provide visible focus indicators, and support reduced motion settings. |
| NFR-5 | Reliability | The system should include mechanisms for retries and ensure idempotency for critical operations like data ingestion and action processing. |
| NFR-6 | Deployment | The application will be deployed on Vercel, with the Node.js runtime set to version 22.x. Vercel Cron Jobs will be used for scheduled tasks. |

## 5. User Story Traceability

| User Story ID | User Story | Related Functional Requirements |
|---|---|---|
| PM-1 | "As a PM, I want a single list of today’s critical asks so I don’t miss deadlines." | FR-1, FR-8 |
| Exec-1 | "As an Exec, I want an 8am/1pm/5pm digest to keep interruptions low." | FR-2 |
| IC-1 | "As an IC, I want tasks auto-created from meeting notes so follow-ups aren’t lost." | FR-1, FR-3, FR-7 |
| Manager-1 | "As a Manager, I want delegation shortcuts to reassign in one click." | FR-3 |
| Teammate-1 | "As a Teammate, I want threads summarized so I can catch up fast." | FR-6 |

