// nesse codigo termine a funcao webSearch, para o Gemini fazer pesquisas na web
// lenbrando que o gemini ja possui esse recurso de pesquisa
// me responda em portugues
import { GoogleGenAI } from "@google/genai";
import type { GroundingMetadata } from "@google/genai";
import OpenAI from "openai";
import logger from '../utils/logger';

// Tipos mínimos para config e resultado
interface GeminiConfig {
  GOOGLE_API_KEY: string;
  GEMINI_MODEL: string;
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

// Tipos para metadados de embasamento
// interface GroundingMetadata {
//   searchEntryPoint?: {
//     renderedContent: string;
//   };
//   groundingChunks?: Array<{
//     web?: {
//       uri: string;
//       title: string;
//     };
//   }>;
//   webSearchQueries?: string[];
// }

export class GeminiClient {
  private registry: any;
  private client: any;
  private config: GeminiConfig;
  private model: string;
  private systemInstruction: string;
  private tools: any;
  private assistant: any;

  constructor(config: GeminiConfig, registry: any) {
    this.registry = registry;
    this.client = new OpenAI({
      apiKey: config.GOOGLE_API_KEY,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/", // endpoint Gemini via OpenAI
    });
    this.model = config.GEMINI_MODEL;
    this.systemInstruction = config.RULES;
    this.tools = registry.getOpenAiTools();
    this.assistant = null;
    this.config = config;
  }

  async initializeAssistant(): Promise<void> {
    if (!this.assistant) {
      this.assistant = await this.client.beta.assistants.create({
        model: this.model,
        instructions: this.systemInstruction,
        tools: this.tools,
      });
      logger.info(`Assistant Gemini criado com ID: ${this.assistant.id}`);
    }
  }

  async processCommand(command: string): Promise<AgentResult> {
    try {
      let result: AgentResult = { text: '', function_calls: [] };
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
      logger.error(`Erro ao processar comando: ${error.message}`);
      return { text: `**Erro**: Erro ao processar comando: ${error.message}`, function_calls: [] };
    }
  }

  async webSearch(command: string): Promise<AgentResult> {
    try {
      logger.info(`Realizando pesquisa na web com Gemini para o comando: ${command}`);

      // Inicializar o cliente do Gemini
      const genAI = new GoogleGenAI({ apiKey: this.config.GOOGLE_API_KEY });

      // Realizar a pesquisa com a ferramenta Google Search
      const response = await genAI.models.generateContent({
        model: this.model,
        contents: [command],
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      // Extrair o texto da resposta
      const responseText = response.text || "Nenhum resultado de pesquisa encontrado.";

      // Extrair metadados de embasamento
      const groundingMetadata: GroundingMetadata = response.candidates?.[0]?.groundingMetadata || {};

      // Formatando os links de suporte
      const sources = groundingMetadata.groundingChunks
        ?.filter(chunk => chunk.web)
        .map(chunk => `- [${chunk.web!.title}](${chunk.web!.uri})`)
        .join("\n") || "Nenhuma fonte de fundamentação disponível.";

      // Formatando as sugestões de pesquisa
      const searchSuggestions = groundingMetadata.webSearchQueries
        ?.map(query => `- ${query}`)
        .join("\n") || "Nenhuma sugestão de pesquisa disponível.";

      // Incluindo o renderedContent das sugestões, se disponível
      const renderedContent = groundingMetadata.searchEntryPoint?.renderedContent
        ? `\n**Sugestões de Pesquisa Renderizadas**:\n${groundingMetadata.searchEntryPoint.renderedContent}`
        : "";

      // Montar a resposta final
      const formattedResponse = `**Resposta**:\n${responseText}\n\n**Fontes**:\n${sources}\n\n**Sugestões de Pesquisa**:\n${searchSuggestions}${renderedContent}`;

      return {
        text: formattedResponse,
        function_calls: [],
      };
    } catch (error: any) {
      logger.error(`Erro ao realizar pesquisa na web: ${error.message}`);
      return {
        text: `**Erro**: Erro ao realizar pesquisa na web: ${error.message}`,
        function_calls: [],
      };
    }
  }
}