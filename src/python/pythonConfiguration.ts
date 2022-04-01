import * as vscode from "vscode";

export default class PythonConfiguration {
  static pythonConfiguration = vscode.workspace.getConfiguration("inline-parameters.python");

  /**
   * @returns Enable inline parameters for go.
   */
  static enabled(): boolean {
    return this.pythonConfiguration.get("enabled");
  }

  /**
   * @returns Should the inlay hint appear before the parameter. If this is set to `false` the hint will appear after the parameter.
   */
  static hintBeforeParameter(): boolean {
    return this.pythonConfiguration.get("hintBeforeParameter");
  }

  /**
   * @returns Show the number of times a variadic parameter has been called.
   */
  static showVariadicNumbers(): boolean {
    return this.pythonConfiguration.get("showVariadicNumbers");
  }

  /**
   * @returns Suppress parameter name hints on arguments whose text is identical to the parameter name.
   */
  static suppressWhenArgumentMatchesName(): boolean {
    return this.pythonConfiguration.get("suppressWhenArgumentMatchesName");
  }
}