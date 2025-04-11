import OpenAI from "openai";
import { useMemo, useState } from "react";
import { requestData } from "./ChatbotTab/data";

export function useChatCompletion({ getApiKey, instanceId, model, user }) {
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
          getApiKey,
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
  getApiKey,
  instanceId,
  messages,
  model,
  setCompletionMessage,
  setLoading,
  setMessages,
  user,
}) {
  let content = "";
  let role = null;
  let message = null;
  let finishReason;

  // genai-service - $LATEST: https://zvsk3xf4tjzsfmypkyczd24gpq0hmfds.lambda-url.eu-central-1.on.aws/v1
  // genai-service - active: https://lhkrr3a4vxmag37o5voius7jbi0wcvie.lambda-url.eu-central-1.on.aws/v1
  // test API Gateway: https://97uhfswdhd.execute-api.eu-central-1.amazonaws.com/gen-ai/v1
  // genai-service-dev - stable: https://3ztb7l4rouk5qzb2ftjvjjjzoi0mmvow.lambda-url.eu-central-1.on.aws/v1
  // genai-service-dev - $LATEST: https://p62etaa3urpzbpupglmwl6ytfa0pkwwk.lambda-url.eu-central-1.on.aws/v1
  // openAiApiProxy (ip-saas-dev): https://e7iuggnyr4t2grfrffawjd2q5a0mdcgh.lambda-url.eu-central-1.on.aws/v1
  // http://localhost:3000/v1

  do {
    const client = new OpenAI({
      apiKey: OPENAI_API_KEY || (await getApiKey?.()),
      baseURL: OPENAI_API_KEY
        ? "https://api.openai.com/v1"
        : "http://localhost:3000/v1",

      defaultQuery: { instance_id: instanceId },
      dangerouslyAllowBrowser: true,
    });

    finishReason = null;
    let stream;

    try {
      stream = await client.beta.chat.completions.runTools(requestData);
    } catch (error) {
      setCompletionMessage(null);
      setMessages(
        messages.concat({ role: "assistant", content: error.toString() })
      );
      setLoading(false);
      return;
    }

    for await (const chunk of stream) {
      const { delta, finish_reason } = chunk.choices[0];
      finishReason = finish_reason;
      role ||= delta.role;
      if (delta.content) {
        content += delta.content;
        setCompletionMessage({ role, content });
      }
      message = { role, content };
    }
  } while (finishReason === "length" && content.length < MAX_OUTPUT_TOKENS * 4);

  setCompletionMessage(null);
  setMessages(messages.concat(message));
  setLoading(false);
}

const MAX_OUTPUT_TOKENS = 32_000;
