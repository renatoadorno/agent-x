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

export class OpenAIClient {
  constructor(rules, registry) {
    this.registry = registry;
    this.client = new OpenAI({
      apiKey: Bun.env.XAI_API_KEY,
      baseURL: "https://api.x.ai/v1",
    });
    this.model = Bun.env.XAI_MODEL; // Default to GPT-4o, configurable
    this.systemInstruction = rules; // System prompt or rules
    this.tools = registry.getOpenAiTools();
    this.assistant = null;
  }

  async initializeAssistant() {
    if (!this.assistant) {
      this.assistant = await this.client.beta.assistants.create({
        model: this.model,
        instructions: this.systemInstruction,
        tools: [{ type: "web_search_preview" }], // Enable web search tool
      });
      logger.info(`Assistant created with ID: ${this.assistant.id}`);
    }
  }

  async processCommand(command) {
    try {
      let result = { text: "", function_calls: [] };
      let messages = [
        { role: "system", content: this.systemInstruction },
        { role: "user", content: command },
      ];

      while (true) {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages,
          tools: this.tools,
          tool_choice: "auto", // Let the model decide when to call tools
        });

        const message = response.choices[0].message;
        messages.push(message); // Add assistant response to conversation history

        // Check for tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
          for (const toolCall of message.tool_calls) {
            const functionName = toolCall.function.name;
            const parameters = JSON.parse(toolCall.function.arguments);

            logger.info(
              `Calling function: ${functionName} with parameters: ${JSON.stringify(
                parameters
              )}`
            );

            const func = this.registry.getFunctionMap()[functionName];
            if (func) {
              const funcResult = await func(parameters);
              result.function_calls.push({
                name: functionName,
                parameters,
                result: funcResult,
              });

              // Add tool call result to messages
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
          // No more tool calls; get final text response
          result.text = message.content || "";
          break;
        }
      }

      return result;
    } catch (error) {
      // logger.error(`Erro ao processar comando: ${error.message}`);
      return {
        text: `**Erro**: Erro ao processar comando: ${error.message}`,
        function_calls: [],
      };
    }
  }

  async webSearch(command) {
    try {
      logger.info(`Performing web search for command: ${command}`);

      // Initialize assistant if not already done
      await this.initializeAssistant();

      // Create a new thread for the search
      const thread = await this.client.beta.threads.runs.create();

      // Add the search query to the thread
      await this.client.beta.threads.messages.create(thread.id, {
        role: "user",
        content: command,
      });

      // Run the assistant with web search enabled
      const run = await this.client.beta.threads.runs.create(thread.id, {
        assistant_id: this.assistant.id,
        tools: [{ type: "web_search" }],
      });

      // Poll for run completion
      let runStatus = await this.client.beta.threads.runs.retrieve(
        thread.id,
        run.id
      );
      while (
        runStatus.status !== "completed" &&
        runStatus.status !== "failed"
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
        runStatus = await this.client.beta.threads.runs.retrieve(
          thread.id,
          run.id
        );
      }

      if (runStatus.status === "failed") {
        throw new Error(
          `Web search run failed: ${
            runStatus.last_error?.message || "Unknown error"
          }`
        );
      }

      // Retrieve the messages from the thread
      const messages = await this.client.beta.threads.messages.list(thread.id);
      const responseMessage = messages.data.find(
        (msg) => msg.role === "assistant"
      );

      if (!responseMessage || !responseMessage.content[0]?.text?.value) {
        return { text: "No search results found.", function_calls: [] };
      }

      const responseText = responseMessage.content[0].text.value;
      return { text: responseText, function_calls: [] };
    } catch (error) {
      logger.error(`Erro ao realizar pesquisa na web: ${error.message}`);
      return {
        text: `**Erro**: Erro ao realizar pesquisa na web: ${error.message}`,
        function_calls: [],
      };
    }
  }
}
