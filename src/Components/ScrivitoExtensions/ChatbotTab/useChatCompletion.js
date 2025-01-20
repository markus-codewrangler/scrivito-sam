import OpenAI from "openai";
import { useMemo, useState } from "react";

export function useChatCompletion({ apiKey, instanceId, model, user }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [completionMessage, setCompletionMessage] = useState(null);

  const messagesWithCompletion = useMemo(
    () => (completionMessage ? messages.concat(completionMessage) : messages),
    [messages, completionMessage]
  );

  return {
    loading,
    messages: messagesWithCompletion,
    submitPrompt: (prompt) => {
      setCompletionMessage(null);
      setLoading(true);
      // @ts-ignore
      setMessages((m) => {
        const messagesWithPrompt = [...m, ...prompt];
        startStreaming({
          apiKey,
          instanceId,
          model,
          messages: messagesWithPrompt,
          setCompletionMessage,
          setLoading,
          setMessages,
          user,
        });
        return messagesWithPrompt;
      });
    },
    abortResponse: () => {},
    resetMessages: () => {
      setCompletionMessage(null);
      setMessages([]);
    },
    setMessages,
  };
}

let OPENAI_API_KEY;
if (typeof process !== "undefined") {
  OPENAI_API_KEY = process.env.OPENAI_API_KEY;
}
// @ts-ignore
if (typeof import.meta.env !== "undefined") {
  // @ts-ignore
  OPENAI_API_KEY = import.meta.env.OPENAI_API_KEY;
}

async function startStreaming({
  apiKey,
  instanceId,
  messages,
  model,
  setCompletionMessage,
  setLoading,
  setMessages,
  user,
}) {
  const client = new OpenAI({
    apiKey: OPENAI_API_KEY || apiKey,
    baseURL: OPENAI_API_KEY
      ? "https://api.openai.com/v1"
      : "http://localhost:3000/v1", // "https://e7iuggnyr4t2grfrffawjd2q5a0mdcgh.lambda-url.eu-central-1.on.aws/v1",

    defaultQuery: { tenant_id: instanceId },
    dangerouslyAllowBrowser: true,
  });

  try {
    const runner = client.beta.chat.completions
      .runTools({
        stream: true,
        model: "aws/anthropic.claude-3-5-sonnet-20240620-v1:0", // "gpt-4o", //
        messages: [{ role: "user", content: "How is the weather this week?" }],
        tools: [
          {
            type: "function",
            function: {
              function: getCurrentLocation,
              description: "get the current location",
            },
          },
          {
            type: "function",
            function: {
              function: getWeather,
              parse: JSON.parse,
              parameters: {
                type: "object",
                properties: {
                  location: { type: "string" },
                },
              },
              description: "get weather for location",
            },
          },
        ],
      })
      .on("message", (message) => console.log("message:", message));

    const finalContent = await runner.finalContent();
    console.log("Final content:", finalContent);
  } catch (error) {
    console.error(error);
    setLoading(false);
    return;
  }

  setLoading(false);
}

async function getCurrentLocation(_) {
  return "Boston"; // Simulate lookup
}

async function getWeather(_) {
  return { temperature: "50degF", preciptation: "high" };
}
