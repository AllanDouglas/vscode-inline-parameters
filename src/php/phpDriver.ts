import * as vscode from "vscode";

import { ParameterDetails } from "../utils";
import PHPConfiguration from "./phpConfiguration";
import PHPHelper from "./phpHelper";

export default class phpDriver {
  static Register() {
    vscode.languages.registerInlayHintsProvider("php", new class implements vscode.InlayHintsProvider {
      async provideInlayHints(document: vscode.TextDocument, range: vscode.Range): Promise<vscode.InlayHint[]> {
        const result: vscode.InlayHint[] = [];
        const text = document.getText(range);
        const start = document.offsetAt(range.start);
        const end = document.offsetAt(range.end);

        const functionParameters = PHPHelper.parse(text);
        for (const languageParameters of functionParameters) {
          if (languageParameters === undefined) continue;
          let parameters: ParameterDetails[];

          try {
            parameters = await PHPHelper.getParameterNames(document.uri, languageParameters);
          } catch (error) {
            continue;
          }

          for (let index = 0; index < languageParameters.length; index++) {
            const parameter = languageParameters[index];
            const parameterDetails = parameters[index];

            if (!parameterDetails) continue;

            if (parameter.start.line >= start && parameter.start.line <= end) {
              let inlayHint: vscode.InlayHint;

              if (PHPConfiguration.hintBeforeParameter()) {
                const position = new vscode.Position(parameter.start.line, parameter.start.character);
                const inlayHintPart = new vscode.InlayHintLabelPart(parameterDetails.name);
                inlayHint = new vscode.InlayHint(position, [inlayHintPart], vscode.InlayHintKind.Parameter);
                inlayHint.tooltip = new vscode.MarkdownString(parameterDetails.definition);
                inlayHint.paddingRight = true;
              } else {
                const position = new vscode.Position(parameter.end.line, parameter.end.character);
                const inlayHintPart = new vscode.InlayHintLabelPart(parameterDetails.name);
                inlayHint = new vscode.InlayHint(position, [inlayHintPart], vscode.InlayHintKind.Parameter);
                inlayHint.tooltip = new vscode.MarkdownString(parameterDetails.definition);
                inlayHint.paddingLeft = true;
              }

              result.push(inlayHint);
            }
          }
        }

        return result;
      }
    });
  }
}
