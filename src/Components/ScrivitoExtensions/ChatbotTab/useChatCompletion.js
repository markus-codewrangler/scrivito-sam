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
      : "https://e7iuggnyr4t2grfrffawjd2q5a0mdcgh.lambda-url.eu-central-1.on.aws/v1",

    defaultQuery: { tenant_id: instanceId },
    dangerouslyAllowBrowser: true,
  });

  let stream;

  try {
    stream = await client.chat.completions.create({
      model,
      messages,
      stream: true,
      user,
    });
  } catch (error) {
    console.error(error);
    setLoading(false);
    return;
  }

  const message = {};

  for await (const chunk of stream) {
    const { content, role } = chunk.choices[0].delta;
    if (role) message.role = role;
    if (content) {
      message.content = [message.content, content].join("");
      setCompletionMessage({ ...message });
    }
  }

  setCompletionMessage(null);
  setMessages(messages.concat({ ...message }));
  setLoading(false);
}
