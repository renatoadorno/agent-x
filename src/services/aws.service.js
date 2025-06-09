import { LambdaClient, ListFunctionsCommand } from "@aws-sdk/client-lambda";

export class LambdaService {
  constructor() {
    this.client = new LambdaClient({ region: 'us-east-1' });
    this.command = new ListFunctionsCommand();
  }

  getFunctionDeclarations() {
    return [
      {
        name: 'lambdaFunctonsList',
        description: 'Lista das funções lambdas da minha aws, retornando detalhes de varias funções',
      },
    ];
  }

  getFunctionMap() {
    return {
      lambdaFunctonsList: this.lambdaFunctonsList.bind(this),
    };
  }

  async lambdaFunctonsList() {
    const { Functions } = await this.client.send(this.command);
    const orderFuncs = Functions?.sort((a, b) => {
      const nomeA = a?.FunctionName || "";
      const nomeB = b?.FunctionName || "";
      return nomeA.localeCompare(nomeB);
    });

    const funcList = orderFuncs?.map((obj) => ({
      name: obj.FunctionName,
      description: obj?.Description,
      environment: obj.Environment?.Variables,
    }))

    const choices = funcList.map((obj) => ({
      name: obj.name,
      description: obj.description
    }))

    return choices
  }
}