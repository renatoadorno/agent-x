import OpenAI from "openai";
import logger from '../utils/logger';

const googleCliente = new OpenAI({
  apiKey: Bun.env.GOOGLE_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

const xAiClient = new OpenAI({
  apiKey: Bun.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

export class OpenAIClient {
  constructor(rules, registry) {
    this.registry = registry;
    this.client = new OpenAI({
      apiKey: Bun.env.XAI_API_KEY,
      baseURL: "https://api.x.ai/v1",
    });
    this.model = Bun.env.MODEL; // Default to GPT-4o, configurable
    this.systemInstruction = rules; // System prompt or rules
    this.tools = registry.getOpenAiTools();
  }

  async processCommand(command) {
    try {
      let result = { text: '', function_calls: [] };
      let messages = [
        { role: 'system', content: this.systemInstruction },
        { role: 'user', content: command },
      ];

      while (true) {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages,
          tools: this.tools,
          tool_choice: 'auto', // Let the model decide when to call tools
        });

        const message = response.choices[0].message;
        messages.push(message); // Add assistant response to conversation history

        // Check for tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
          for (const toolCall of message.tool_calls) {
            const functionName = toolCall.function.name;
            const parameters = JSON.parse(toolCall.function.arguments);

            logger.info(`Calling function: ${functionName} with parameters: ${JSON.stringify(parameters)}`);

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
                role: 'tool',
                content: JSON.stringify({ result: funcResult }),
                tool_call_id: toolCall.id,
              });
            } else {
              const errorText = `**Erro**: Função \`${functionName}\` não encontrada.`;
              messages.push({ role: 'assistant', content: errorText });
              return { text: errorText, function_calls: result.function_calls };
            }
          }
        } else {
          // No more tool calls; get final text response
          result.text = message.content || '';
          break;
        }
      }

      return result;
    } catch (error) {
      // logger.error(`Erro ao processar comando: ${error.message}`);
      return { text: `**Erro**: Erro ao processar comando: ${error.message}`, function_calls: [] };
    }
  }
}