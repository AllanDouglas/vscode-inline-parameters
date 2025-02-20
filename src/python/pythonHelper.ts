import { execSync } from "child_process";
import { PythonShell } from "python-shell";
import * as vscode from "vscode";

import Helper from "../helpers/helper";
import Output from "../helpers/output";
import ParameterDetails from "../helpers/parameterDetails";
import ParameterPosition from "../helpers/parameterPosition";
import PythonConfiguration from "./pythonConfiguration";

export default class PythonHelper {
  static parse(text: string, code: string, range: vscode.Range, fsPath: string, context: vscode.ExtensionContext): ParameterPosition[][] {
    const pythonPath = PythonHelper.getPythonPath().replace(/\\/g, "/");
    // const extensionPath = `${context.extensionPath.replace(/\\/g, "/")}/src/python/helpers/main.py`; // Development
    const extensionPath = `${context.extensionPath.replace(/\\/g, "/")}/out/src/python/helpers/main.py`; // Production
    const startLine = range.start.line;
    const endLine = range.end.line;

    const command = `"${pythonPath}" "${extensionPath}" "${fsPath}" ${startLine} ${endLine}`;
    Output.outputChannel.appendLine(`Python Command: ${command}`);
    const output = execSync(command).toString();

    return this.getParametersFromOutput(text, output);
  }

  public static getPythonPath(resource: vscode.Uri = null): string {
    if (PythonConfiguration.executablePath()) {
      return PythonConfiguration.executablePath();
    }
    // adapted from vscode-restructuredtext/vscode-restructuredtext#224
    const extension = vscode.extensions.getExtension("ms-python.python");
    if (!extension) {
      return PythonShell.defaultPythonPath;
    }

    const pythonPath = extension.exports.settings.getExecutionDetails(resource).execCommand;
    return pythonPath[0]; // might be more elements if conda, but we are not bothering to support that yet
  }

  static getParametersFromOutput(code: string, output: string): ParameterPosition[][] | undefined {
    const parameters: ParameterPosition[][] = [];
    const lines = output.split("\n");
    const codeLines = code.split("\n");
    let key = 0;
    let index = 0;
    parameters[index] = [];

    for (const line of lines) {
      const newExpressionRegex = /NEW EXPRESSION/;
      const pythonRegex = /expression line: (.*?) \| expression character: (.*?) \| expression end line: (.*?) \| expression end character: (.*?) \| argument start line: (.*?) \| argument start character: (.*?) \| argument end line: (.*?) \| argument end character: (.*)/;

      if (newExpressionRegex.test(line)) {
        if (parameters[index].length > 0) {
          index++;
          parameters[index] = [];
        }
        key = 0;
        continue;
      }

      if (pythonRegex.test(line)) {
        const result = pythonRegex.exec(line);
        const expressionLine = parseInt(result[1]) - 1;
        const expressionCharacter = parseInt(result[2]);
        const expressionEndLine = parseInt(result[3]) - 1;
        const expressionEndCharacter = parseInt(result[4]);
        const argumentStartLine = parseInt(result[5]) - 1;
        const argumentStartCharacter = parseInt(result[6]);
        const argumentEndLine = parseInt(result[7]) - 1;
        const argumentEndCharacter = parseInt(result[8]);
        let namedValue = undefined;

        if (argumentStartLine === argumentEndLine) {
          namedValue = codeLines[argumentStartLine].substring(argumentStartCharacter, argumentEndCharacter);
        }

        const parameterPosition: ParameterPosition = {
          namedValue: namedValue,
          expression: {
            start: {
              line: expressionLine,
              character: expressionCharacter,
            },
            end: {
              line: expressionEndLine,
              character: expressionEndCharacter
            }
          },
          key: key,
          start: {
            line: argumentStartLine,
            character: argumentStartCharacter,
          },
          end: {
            line: argumentEndLine,
            character: argumentEndCharacter,
          }
        };

        parameters[index].push(parameterPosition);
        key++;
      }
    }

    return parameters;
  }

  static async getParameterNames(uri: vscode.Uri, languageParameters: ParameterPosition[]): Promise<ParameterDetails[]> {
    let isVariadic = false;
    let definition = "";
    let definitions: string[];
    const firstParameter = languageParameters[0];
    const description: any = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      uri,
      new vscode.Position(
        firstParameter.expression.end.line,
        firstParameter.expression.end.character
      )
    );

    const pythonParameterNameRegex = /^[a-zA-Z_]([0-9a-zA-Z_]+)?/g;
    if (description && description.length > 0) {
      try {
        const regEx = /.*?\((?:function|method)\).*?\((.*?)\)/gs;
        definitions = Helper.getFunctionDefinition(<vscode.MarkdownString[]>description[0].contents)?.match(regEx);

        if (!definitions || !definitions[0]) {
          return Promise.reject();
        }

        definition = definitions[0];
      } catch (error) {
        console.error(error);
      }
    }

    definition = definition.replace(/\(function\)/, "");
    definition = definition.replace(/\(method\)/, "");

    const parameters: string[] = definition
      .substring(definition.indexOf("(") + 1, definition.indexOf(")"))
      // eslint-disable-next-line no-useless-escape
      .split(/,/)
      .map(parameter => parameter.trim())
      .map(parameter => {
        const matches = parameter.replace(/\*/g, "").match(pythonParameterNameRegex);
        if (!matches || !matches[0] || isVariadic) {
          return null;
        }
        if (parameter.includes("*")) isVariadic = true;

        return matches[0];
      })
      .filter(parameter => parameter);

    if (!parameters || parameters.length === 0) {
      return Promise.reject();
    }

    let namedValue = undefined;
    const parametersLength = parameters.length;
    const suppressWhenArgumentMatchesName = PythonConfiguration.suppressWhenArgumentMatchesName();
    for (let i = 0; i < languageParameters.length; i++) {
      const parameter = languageParameters[i];
      const key = parameter.key;

      if (isVariadic && key >= parameters.length - 1) {
        if (namedValue === undefined) namedValue = parameters[parameters.length - 1];

        if (suppressWhenArgumentMatchesName && namedValue === parameter.namedValue) {
          parameters[i] = undefined;
          continue;
        }

        const number = key - parametersLength + 1;
        parameters[i] = PythonConfiguration.showVariadicNumbers() ? `${namedValue}[${number}]` : namedValue;

        continue;
      }

      if (parameters[key]) {
        const name = parameters[key];

        if (suppressWhenArgumentMatchesName && name === parameter.namedValue) {
          parameters[i] = undefined;
        }

        continue;
      }

      parameters[i] = undefined;
      continue;
    }

    const parameterDetails: ParameterDetails[] = parameters.map((value): ParameterDetails => {
      const parameter: ParameterDetails = {
        name: value,
        definition: ""
      };

      return parameter;
    });

    return parameterDetails;
  }
}
