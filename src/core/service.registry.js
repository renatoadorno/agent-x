
export class ServiceRegistry {
  constructor() {
    this.services = [];
    this.functionMap = new Map();
  }

  registerService(service) {
    this.services.push(service);
    const serviceFunctions = service.getFunctionMap();
    for (const [name, func] of Object.entries(serviceFunctions)) {
      this.functionMap.set(name, func);
    }
  }

  getTools() {
    const functionDeclarations = [];
    for (const service of this.services) {
      functionDeclarations.push(...service.getFunctionDeclarations());
    }
    return [{ functionDeclarations }];
  }

  getOpenAiTools() {
    const functionDeclarations = [];
    for (const service of this.services) {
      functionDeclarations.push(...service.getFunctionDeclarations());
    }

    return functionDeclarations.map(tool => {
      return {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool?.parameters || {},
        },
      }
    });
  }

  getFunctionMap() {
    return Object.fromEntries(this.functionMap);
  }
}