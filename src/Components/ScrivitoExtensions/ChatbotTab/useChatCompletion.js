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
if (typeof process.env.OPENAI_API_KEY !== "undefined") {
  OPENAI_API_KEY = process.env.OPENAI_API_KEY;
}
// @ts-ignore
if (typeof import.meta.env.OPENAI_API_KEY !== "undefined") {
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
      : "https://e7iuggnyr4t2grfrffawjd2q5a0mdcgh.lambda-url.eu-central-1.on.aws/v1",

    defaultQuery: { tenant_id: instanceId },
    defaultHeaders: { Accept: "*/*" },
    dangerouslyAllowBrowser: true,
    fetch: async (url, init) =>
      fetch(url, { ...init, headers: cleanHeaders(init?.headers) }),
  });

  const stream = await client.beta.chat.completions.stream({
    model,
    messages,
    stream: true,
    user,
  });

  stream.on("error", () => {
    setLoading(false);
  });

  stream.on("content", () => {
    const message = stream.currentChatCompletionSnapshot?.choices[0].message;
    if (message) setCompletionMessage({ ...message });
  });

  return stream.finalChatCompletion().then(({ choices }) => {
    setCompletionMessage(null);
    const { tool_calls, ...otherMessageAttributes } = choices[0].message;
    setMessages(messages.concat({ ...otherMessageAttributes }));
    setLoading(false);
  });
}

function cleanHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers)
      .filter(([k]) => !k.startsWith("x-"))
      .map(([k, v]) => [
        k
          .replace("content-length", "Content-Length")
          .replace("content-type", "Content-Type")
          .replace("authorization", "Authorization")
          .replace("accept", "Accept"),
        v,
      ])
  );
}
