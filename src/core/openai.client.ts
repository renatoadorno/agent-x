// nesse codigo termine a funcao webSearch, para OpenAI fazer pesquisas na web
import OpenAI from "openai";
import logger from "../utils/logger";

// const googleCliente = new OpenAI({
//   apiKey: Bun.env.GOOGLE_API_KEY,
//   baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
// });

// const xAiClient = new OpenAI({
//   apiKey: Bun.env.XAI_API_KEY,
//   baseURL: "https://api.x.ai/v1",
// });

// Tipos mínimos para config e resultado
interface AgentConfig {
  XAI_API_KEY: string;
  XAI_MODEL: string;
  RULES: string;
}

interface FunctionCallResult {
  name: string;
  parameters: any;
  result: any;
}

interface AgentResult {
  text: string;
  function_calls: FunctionCallResult[];
}

export class OpenAIClient {
  private registry: any;
  private client: any;
  private model: string;
  private systemInstruction: string;
  private tools: any;
  private assistant: any;

  constructor(config: AgentConfig, registry: any) {
    this.registry = registry;
    this.client = new OpenAI({
      apiKey: config.XAI_API_KEY,
      baseURL: "https://api.x.ai/v1",
    });
    this.model = config.XAI_MODEL;
    this.systemInstruction = config.RULES;
    this.tools = registry.getOpenAiTools();
    this.assistant = null;
  }

  async initializeAssistant(): Promise<void> {
    if (!this.assistant) {
      this.assistant = await this.client.beta.assistants.create({
        model: this.model,
        instructions: this.systemInstruction,
        tools: [{ type: "web_search_preview" }],
      });
      logger.info(`Assistant created with ID: ${this.assistant.id}`);
    }
  }

  async processCommand(command: string): Promise<AgentResult> {
    try {
      let result: AgentResult = { text: "", function_calls: [] };
      let messages: any[] = [
        { role: "system", content: this.systemInstruction },
        { role: "user", content: command },
      ];

      while (true) {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages,
          tools: this.tools,
          tool_choice: "auto",
        });

        const message = response.choices[0].message;
        messages.push(message);

        if (message.tool_calls && message.tool_calls.length > 0) {
          for (const toolCall of message.tool_calls) {
            const functionName = toolCall.function.name;
            const parameters = JSON.parse(toolCall.function.arguments);

            logger.info(
              `Calling function: ${functionName} with parameters: ${JSON.stringify(parameters)}`
            );

            const func = this.registry.getFunctionMap()[functionName];
            if (func) {
              const funcResult = await func(parameters);
              result.function_calls.push({
                name: functionName,
                parameters,
                result: funcResult,
              });

              messages.push({
                role: "tool",
                content: JSON.stringify({ result: funcResult }),
                tool_call_id: toolCall.id,
              });
            } else {
              const errorText = `**Erro**: Função \`${functionName}\` não encontrada.`;
              messages.push({ role: "assistant", content: errorText });
              return { text: errorText, function_calls: result.function_calls };
            }
          }
        } else {
          result.text = message.content || "";
          break;
        }
      }

      return result;
    } catch (error: any) {
      return {
        text: `**Erro**: Erro ao processar comando: ${error.message}`,
        function_calls: [],
      };
    }
  }

  async webSearch(command: string): Promise<AgentResult> {
    try {
      logger.info(`Performing web search for command: ${command}`);
      await this.initializeAssistant();
      const thread = await this.client.beta.threads.runs.create();
      await this.client.beta.threads.messages.create(thread.id, {
        role: "user",
        content: command,
      });
      const run = await this.client.beta.threads.runs.create(thread.id, {
        assistant_id: this.assistant.id,
        tools: [{ type: "web_search" }],
      });
      let runStatus = await this.client.beta.threads.runs.retrieve(
        thread.id,
        run.id
      );
      while (
        runStatus.status !== "completed" &&
        runStatus.status !== "failed"
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        runStatus = await this.client.beta.threads.runs.retrieve(
          thread.id,
          run.id
        );
      }
      if (runStatus.status === "failed") {
        throw new Error(
          `Web search run failed: ${runStatus.last_error?.message || "Unknown error"}`
        );
      }
      const messages = await this.client.beta.threads.messages.list(thread.id);
      const responseMessage = messages.data.find(
        (msg: any) => msg.role === "assistant"
      );
      if (!responseMessage || !responseMessage.content[0]?.text?.value) {
        return { text: "No search results found.", function_calls: [] };
      }
      const responseText = responseMessage.content[0].text.value;
      return { text: responseText, function_calls: [] };
    } catch (error: any) {
      logger.error(`Erro ao realizar pesquisa na web: ${error.message}`);
      return {
        text: `**Erro**: Erro ao realizar pesquisa na web: ${error.message}`,
        function_calls: [],
      };
    }
  }
}
