import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Generate link title and description suggestions based on URL
export async function generateLinkSuggestions(url: string): Promise<{ 
  title: string;
  description: string;
  cta: string;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You're a marketing specialist helping to optimize link-in-bio content. Analyze the given URL and generate a catchy title, a brief description, and a call-to-action (CTA) text for the link. Return your response as JSON with three fields: title, description, and cta."
        },
        {
          role: "user",
          content: `Please analyze this URL and suggest good link title, description, and CTA text for a link-in-bio page: ${url}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    const result = JSON.parse(content);

    return {
      title: result.title || "New Link",
      description: result.description || "Check out this link",
      cta: result.cta || "Click here"
    };
  } catch (error) {
    console.error("Error generating link suggestions:", error);
    return {
      title: "New Link",
      description: "Check out this link",
      cta: "Click here"
    };
  }
}

// Generate weekly performance insights
export async function generatePerformanceInsights(linkData: {
  title: string;
  url: string;
  clickData: { date: string; clicks: number; country: string; device: string }[];
}): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You're an analytics expert providing insights on link performance. Give a single, actionable insight based on the link performance data."
        },
        {
          role: "user",
          content: `Please analyze this performance data for the link "${linkData.title}" (${linkData.url}) and provide one key insight: ${JSON.stringify(linkData.clickData)}`
        }
      ]
    });

    return response.choices[0].message.content || "No insights available at this time.";
  } catch (error) {
    console.error("Error generating performance insights:", error);
    return "Unable to generate insights at this time.";
  }
}

// Generate link order recommendations
export async function generateLinkOrderRecommendations(links: {
  id: number;
  title: string;
  position: number;
  clicks: number;
  ctr: number;
}[]): Promise<{ 
  recommendedOrder: number[];
  explanation: string;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You're an optimization specialist. Based on the provided link performance data, recommend an optimal order for the links to maximize overall click-through rate. Return a JSON object with two properties: 'recommendedOrder' (an array of link IDs in the recommended order) and 'explanation' (a brief explanation of your recommendation)."
        },
        {
          role: "user",
          content: `Please analyze these links and recommend the best order for maximum engagement: ${JSON.stringify(links)}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error("Error generating link order recommendations:", error);
    return {
      recommendedOrder: links.map(link => link.id),
      explanation: "Unable to generate recommendations at this time."
    };
  }
}
