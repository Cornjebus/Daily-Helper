# Technical Design Document (TDD)

## 1. Introduction

This document provides a detailed technical design for the **AI for Daily Life — Unified Focus Assistant**. It covers the system's modules, interfaces, and the logic for its core AI-powered features.

## 2. Modules

The system is composed of the following modules:

*   **Ingestion Module**: Responsible for fetching data from external services (Gmail, Slack, Google Calendar, Calendly).
*   **Scoring Module**: Assigns a priority score to each ingested item using the OpenAI API with cost monitoring.
*   **Summarization Module**: Generates summaries for long threads and documents using Enron dataset-trained models.
*   **Bundle & Brief Module**: Groups related items and provides a brief overview.
*   **Action Module**: Handles one-click actions including task creation in Notion, Linear, and Trello.
*   **AI Cost Monitoring Module**: Tracks OpenAI token usage and provides optimization recommendations.
*   **Task Management Integration Module**: Manages connections to Notion, Linear, and Trello APIs for task creation and delegation.

## 3. Interfaces

### 3.1. API Endpoints

*   `POST /api/ingest/{gmail|slack|calendar|calendly}`: Triggers the ingestion process for the specified service.
*   `POST /api/score`: Takes an item as input and returns a priority score with cost tracking.
*   `POST /api/digest/send`: Generates and sends the daily digest.
*   `POST /api/tasks/create`: Creates tasks in connected task management tools (Notion, Linear, Trello).
*   `GET /api/ai/usage`: Returns OpenAI token usage statistics and cost analysis.
*   `POST /api/ai/optimize`: Provides AI cost optimization recommendations.

## 4. Pseudo-code

### 4.1. Scorer with Cost Monitoring

```
function scoreItem(item) {
  const startTime = Date.now();
  const prompt = `Assign a priority score (1-10) to the following item: ${item.content}`;
  const response = openai.complete(prompt);
  
  // Track usage
  trackTokenUsage({
    operation: 'scoring',
    tokens: response.usage.total_tokens,
    cost: calculateCost(response.usage),
    duration: Date.now() - startTime
  });
  
  return response.score;
}
```

### 4.2. Summarizer with Enron Dataset Training

```
function summarizeItem(item) {
  const startTime = Date.now();
  // Use fine-tuned model trained on Enron dataset for email summarization
  const model = item.source === 'gmail' ? 'ft:gpt-3.5-turbo-enron' : 'gpt-3.5-turbo';
  const prompt = `Summarize the following ${item.source} content: ${item.content}`;
  const response = openai.complete(prompt, { model });
  
  trackTokenUsage({
    operation: 'summarization',
    tokens: response.usage.total_tokens,
    cost: calculateCost(response.usage),
    duration: Date.now() - startTime
  });
  
  return response.summary;
}
```

### 4.3. Bundle & Brief

```
function bundleAndBrief(items) {
  const startTime = Date.now();
  const prompt = `Group the following items by topic and provide a brief summary for each group: ${items.map(i => i.content).join('\n')}`;
  const response = openai.complete(prompt);
  
  trackTokenUsage({
    operation: 'bundling',
    tokens: response.usage.total_tokens,
    cost: calculateCost(response.usage),
    duration: Date.now() - startTime
  });
  
  return response.brief;
}
```

### 4.4. Task Creation Integration

```
function createTask(item, platform) {
  switch(platform) {
    case 'notion':
      return notionAPI.createPage({
        parent: { database_id: user.notionDatabaseId },
        properties: {
          title: { title: [{ text: { content: item.title } }] },
          description: { rich_text: [{ text: { content: item.summary } }] },
          priority: { select: { name: item.priority } }
        }
      });
    
    case 'linear':
      return linearAPI.createIssue({
        teamId: user.linearTeamId,
        title: item.title,
        description: item.summary,
        priority: mapPriorityToLinear(item.priority)
      });
    
    case 'trello':
      return trelloAPI.createCard({
        listId: user.trelloListId,
        name: item.title,
        desc: item.summary,
        labels: [getPriorityLabel(item.priority)]
      });
  }
}
```

### 4.5. AI Cost Optimization

```
function optimizeAIUsage() {
  const usage = getTokenUsageStats();
  const recommendations = [];
  
  if (usage.averageTokensPerSummary > 500) {
    recommendations.push({
      type: 'prompt_optimization',
      message: 'Consider shorter prompts for summarization',
      potential_savings: calculateSavings(usage.averageTokensPerSummary * 0.3)
    });
  }
  
  if (usage.redundantCalls > 10) {
    recommendations.push({
      type: 'caching',
      message: 'Implement caching for similar content',
      potential_savings: calculateSavings(usage.redundantCalls * usage.averageCost)
    });
  }
  
  return recommendations;
}
```

## 5. Retries and Idempotency

*   **Retries**: All external API calls will be wrapped in a retry mechanism with exponential backoff.
*   **Idempotency**: All `POST` endpoints will be idempotent, ensuring that repeated requests do not result in duplicate data or actions.

