# Deployment and Ops Guide

## 1. Introduction

This guide provides instructions for deploying and operating the **AI for Daily Life — Unified Focus Assistant** on Vercel.

## 2. Deployment to Vercel

### 2.1. Prerequisites

*   A Vercel account.
*   The project code pushed to a Git repository (GitHub, GitLab, or Bitbucket).

### 2.2. Deployment Steps

1.  **Import Project**: From your Vercel dashboard, click "Add New..." and select "Project".
2.  **Import Git Repository**: Select the Git repository containing your project.
3.  **Configure Project**: Vercel will automatically detect that you are deploying a Next.js application. You will need to configure the following:
    *   **Node.js Version**: In the "Build & Development Settings" section, set the Node.js Version to **22.x**.
    *   **Environment Variables**: Add the necessary environment variables (see the `.env.example` file) for the development, preview, and production environments.
4.  **Deploy**: Click the "Deploy" button.

### 2.3. Node.js Version

It is crucial to set the Node.js version to 22.x. As of September 1, 2025, Node.js 18 is deprecated by Vercel. You can find more information on supported Node.js versions on the [Vercel documentation](https://vercel.com/docs/functions/runtimes).

## 3. Vercel Cron Jobs

To send the daily digest three times a day, you will need to configure Vercel Cron Jobs.

1.  **Navigate to Cron Jobs**: In your project settings, go to the "Cron Jobs" tab.
2.  **Add Cron Jobs**: Add the following cron jobs:
    *   `0 8 * * * /api/digest/send`
    *   `0 13 * * * /api/digest/send`
    *   `0 17 * * * /api/digest/send`

## 4. Environment Variables

Vercel supports environment variables for different environments: Development, Preview, and Production. You can manage these in your project settings under the "Environment Variables" tab. For secrets that need to be exposed to the browser, prefix the variable name with `NEXT_PUBLIC_`.

## 5. Observability

Vercel provides built-in observability features:

*   **Logs**: Real-time logs for all your deployments.
*   **Analytics**: Performance and usage analytics for your application.

## 6. Slack Bolt and googleapis Usage

*   **Slack Bolt**: When configuring your Slack app, use the provided `SLACK_SIGNING_SECRET` and `SLACK_REDIRECT_URI`. Follow the [Slack Bolt for JavaScript documentation](https://slack.dev/bolt-js/tutorial/getting-started) for detailed instructions.
*   **googleapis**: For Google authentication, use the `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`. Ensure you have enabled the Gmail API and Google Calendar API in your Google Cloud project and have configured the OAuth consent screen with the appropriate scopes.

