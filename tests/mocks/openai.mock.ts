// Mock OpenAI API responses
export const mockOpenAIResponse = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          score: 8,
          reasoning: "High priority due to urgent deadline and important sender"
        })
      }
    }
  ],
  usage: {
    prompt_tokens: 50,
    completion_tokens: 25,
    total_tokens: 75
  }
}

export const mockThreadSummaryResponse = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          summary: "Discussion about budget approval with multiple stakeholders",
          keyPoints: [
            "Budget approval needed by EOD",
            "Multiple departments involved",
            "Final decision pending"
          ]
        })
      }
    }
  ],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150
  }
}

export const mockSmartRepliesResponse = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          replies: [
            "Thank you for the update. I'll review and respond by EOD.",
            "Got it, let me look into this and get back to you.",
            "Thanks for letting me know. I'll handle this today."
          ]
        })
      }
    }
  ],
  usage: {
    prompt_tokens: 75,
    completion_tokens: 40,
    total_tokens: 115
  }
}

// Mock the entire OpenAI client
export const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn()
    }
  }
}