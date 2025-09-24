# Functional Requirements Specification (FRS)

## 1. Introduction

This document provides a detailed description of the functional requirements for the **AI for Daily Life — Unified Focus Assistant**. It covers the features, user roles, permissions, workflows, and acceptance criteria for each function.

## 2. Features

### 2.1. Prioritized Focus Feed

*   **Description**: A unified feed that displays items from connected Gmail, Slack, and Google Calendar accounts. Items are prioritized and categorized into "Now," "Next," and "Later" tabs.
*   **Acceptance Criteria**:
    *   The feed must display items from all connected sources.
    *   Items must be correctly categorized based on their priority score.
    *   The user must be able to switch between the "Now," "Next," and "Later" tabs.

### 2.2. 3x Daily Digest Push

*   **Description**: The system will send a digest of key items, decisions, and actions to the user's email or Slack DM three times a day (8am, 1pm, 5pm).
*   **Acceptance Criteria**:
    *   The digest must be sent at the scheduled times.
    *   The digest must contain a summary of the most important items.
    *   The user must be able to choose whether to receive the digest via email or Slack.

### 2.3. One-Click Actions

*   **Description**: Users can perform actions on feed items with a single click. The available actions are: snooze, delegate, schedule, create task in Notion, create issue in Linear, create card in Trello, and schedule via Calendly.
*   **Acceptance Criteria**:
    *   The user must be able to snooze an item, which will hide it from the feed for a specified period.
    *   The user must be able to delegate an item to another person through connected project management tools.
    *   The user must be able to schedule an item, which will create a new event in their Google Calendar or Calendly.
    *   The user must be able to create a task from an item in their preferred task management tool (Notion, Linear, or Trello).
    *   All task creation actions must return a link to the created item in the external system.

### 2.4. AI Cost Monitoring

*   **Description**: The system tracks OpenAI token usage and provides cost optimization recommendations to users.
*   **Acceptance Criteria**:
    *   The system must track token usage for all AI operations (scoring, summarization, bundling).
    *   Users must be able to view their AI usage statistics and costs in a dashboard.
    *   The system must provide optimization recommendations when usage patterns are inefficient.
    *   Users must receive alerts when approaching their AI budget limits.

### 2.5. Enhanced Email Processing

*   **Description**: The system uses Enron dataset-trained models for improved email summarization and action extraction.
*   **Acceptance Criteria**:
    *   Email summarization must use fine-tuned models trained on the Enron dataset.
    *   The system must achieve higher accuracy in email summarization compared to generic models.
    *   Action item extraction from emails must be more precise and contextually relevant.

## 3. Roles and Permissions

*   **User**: A standard user who has connected their accounts and can access all the features of the application.

## 4. Flows

### 4.1. Onboarding Flow

1.  The user signs up for a new account.
2.  The user is prompted to connect their core accounts (Gmail, Slack, Google Calendar).
3.  The user is offered optional integrations (Calendly, Notion, Linear, Trello) for enhanced task management.
4.  The system ingests the initial data from the connected accounts.
5.  The user configures their AI budget and cost monitoring preferences.
6.  The user is taken to the dashboard, where they can see their prioritized feed.

### 4.2. Daily Digest Flow

1.  A scheduled job runs at 8am, 1pm, and 5pm.
2.  The system retrieves the latest high-priority items for each user.
3.  The system generates a summary of the items using the OpenAI API.
4.  The system sends the digest to the user's preferred channel (email or Slack).

