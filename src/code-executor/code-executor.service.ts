import { Injectable } from '@nestjs/common';
import * as vm from 'vm';
import { spawn } from 'child_process';

export interface TestResult {
  testCase: number;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  error?: string;
}

export interface ValidationResult {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  results: TestResult[];
  executionLog: string;
}

@Injectable()
export class CodeExecutorService {
  async validateCode(
    code: string,
    language: string,
    testCases: { input: string; output: string }[],
  ): Promise<ValidationResult> {
    if (!code || !code.trim()) {
      throw new Error('Code cannot be empty');
    }

    if (!language) {
      throw new Error('Language must be specified');
    }

    if (!testCases || testCases.length === 0) {
      throw new Error('No test cases available');
    }

    if (language === 'javascript') {
      return this.validateJavaScript(code, testCases);
    } else if (language === 'python') {
      return this.validatePython(code, testCases);
    } else {
      throw new Error(
        `Language '${language}' is not supported. Supported: javascript, python`,
      );
    }
  }

  private async validateJavaScript(
    code: string,
    testCases: { input: string; output: string }[],
  ): Promise<ValidationResult> {
    const results: TestResult[] = [];
    let executionLog = '';

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      try {
        // Create a sandbox context with console.log capture
        let capturedOutput = '';
        const sandbox: any = {
          console: {
            log: (...args: any[]) => {
              capturedOutput += args.map((a) => String(a)).join(' ') + '\n';
            },
          },
          // Parse input as JSON if possible, otherwise as string
          input: this.parseInput(testCase.input),
        };

        // Run the code in the sandbox to define functions
        const script = new vm.Script(code);
        const context = vm.createContext(sandbox);

        try {
          script.runInContext(context, { timeout: 5000 });
        } catch (err) {
          // If code has syntax error or runtime error during execution, capture it
          const errorMsg = err instanceof Error ? err.message : String(err);
          throw new Error(`Code execution error: ${errorMsg}`);
        }

        // Try to find and call a function
        let actualOutput = '';
        let functionFound = false;

        // Priority: solution > solve > main > first function
        const priorityFunctions = ['solution', 'solve', 'main'];
        let functionToCall: Function | undefined;
        let functionName = '';

        // Check priority functions first
        for (const name of priorityFunctions) {
          if (typeof sandbox[name] === 'function') {
            functionToCall = sandbox[name];
            functionName = name;
            functionFound = true;
            break;
          }
        }

        // If no priority function, find first user-defined function
        if (!functionFound) {
          for (const [key, val] of Object.entries(sandbox)) {
            if (typeof val === 'function' && !key.startsWith('console')) {
              functionToCall = val;
              functionName = key;
              functionFound = true;
              break;
            }
          }
        }

        // Call the function
        if (functionFound && functionToCall) {
          try {
            const result = functionToCall(sandbox.input);
            if (result !== undefined && result !== null) {
              actualOutput = String(result).trim();
            } else if (capturedOutput) {
              actualOutput = capturedOutput.trim();
            }
          } catch (callErr) {
            const errMsg =
              callErr instanceof Error ? callErr.message : String(callErr);
            throw new Error(
              `Error calling function '${functionName}': ${errMsg}`,
            );
          }
        } else if (capturedOutput) {
          // Use console.log output if no function was found
          actualOutput = capturedOutput.trim();
        } else {
          throw new Error(
            'No function found in code (expected solution, solve, or main function)',
          );
        }

        // Compare outputs
        const passed = this.compareOutputs(actualOutput, testCase.output);

        results.push({
          testCase: i + 1,
          input: testCase.input,
          expectedOutput: testCase.output,
          actualOutput,
          passed,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        executionLog += `Test Case ${i + 1}: ${errorMessage}\n`;
        results.push({
          testCase: i + 1,
          input: testCase.input,
          expectedOutput: testCase.output,
          actualOutput: '',
          passed: false,
          error: errorMessage,
        });
      }
    }

    const passedTests = results.filter((r) => r.passed).length;
    const passed = passedTests === results.length;

    return {
      passed,
      totalTests: results.length,
      passedTests,
      results,
      executionLog,
    };
  }

  private async validatePython(
    code: string,
    testCases: { input: string; output: string }[],
  ): Promise<ValidationResult> {
    const results: TestResult[] = [];
    let executionLog = '';

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      try {
        // Create a wrapper script that executes the user's code
        const wrappedCode = `
import json
import sys

# User's code
${code}

# Input handling
try:
    user_input = json.loads('''${testCase.input.replace(/'/g, "\\'")}''')
except:
    user_input = '''${testCase.input.replace(/'/g, "\\'")}'''

# Call the function (expecting a function named 'solution' or similar)
# This is flexible - if code returns directly, use that
try:
    # Try to find and call a function
    if 'solution' in dir():
        result = solution(user_input)
    elif 'solve' in dir():
        result = solve(user_input)
    elif 'main' in dir():
        result = main(user_input)
    else:
        # If no function found, evaluate whatever functions were defined
        import inspect
        functions = [obj for name, obj in globals().items() if callable(obj) and not name.startswith('_')]
        if functions:
            result = functions[-1](user_input)
        else:
            result = None
    
    print(str(result).strip())
except Exception as e:
    print(f"Error: {str(e)}", file=sys.stderr)
    sys.exit(1)
`;

        // Execute Python code
        const actualOutput = await this.executePythonCode(wrappedCode);

        // Compare outputs
        const passed = this.compareOutputs(actualOutput, testCase.output);

        results.push({
          testCase: i + 1,
          input: testCase.input,
          expectedOutput: testCase.output,
          actualOutput,
          passed,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        executionLog += `Test Case ${i + 1}: ${errorMessage}\n`;
        results.push({
          testCase: i + 1,
          input: testCase.input,
          expectedOutput: testCase.output,
          actualOutput: '',
          passed: false,
          error: errorMessage,
        });
      }
    }

    const passedTests = results.filter((r) => r.passed).length;
    const passed = passedTests === results.length;

    return {
      passed,
      totalTests: results.length,
      passedTests,
      results,
      executionLog,
    };
  }

  private executePythonCode(code: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', ['-c', code], {
        timeout: 5000,
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(
            new Error(
              stderr || `Python execution failed with exit code ${code}`,
            ),
          );
        }
      });

      python.on('error', (err) => {
        // If python3 not found, try python
        if ((err as any).code === 'ENOENT') {
          const pythonFallback = spawn('python', ['-c', code], {
            timeout: 5000,
          });

          let stdout2 = '';
          let stderr2 = '';

          pythonFallback.stdout.on('data', (data) => {
            stdout2 += data.toString();
          });

          pythonFallback.stderr.on('data', (data) => {
            stderr2 += data.toString();
          });

          pythonFallback.on('close', (code) => {
            if (code === 0) {
              resolve(stdout2.trim());
            } else {
              reject(new Error(stderr2 || 'Python execution failed'));
            }
          });

          pythonFallback.on('error', (err2) => {
            reject(new Error('Python is not installed or not found in PATH'));
          });
        } else {
          reject(err);
        }
      });
    });
  }

  private parseInput(input: string): any {
    try {
      return JSON.parse(input);
    } catch {
      return input;
    }
  }

  private compareOutputs(actual: string, expected: string): boolean {
    // Trim whitespace and compare
    const actualTrimmed = actual.trim().replace(/\s+/g, ' ');
    const expectedTrimmed = expected.trim().replace(/\s+/g, ' ');

    if (actualTrimmed === expectedTrimmed) {
      return true;
    }
    // Try numeric comparison if both are numbers
    const actualNum = parseFloat(actualTrimmed);
    const expectedNum = parseFloat(expectedTrimmed);

    if (!isNaN(actualNum) && !isNaN(expectedNum)) {
      // Allow small floating point differences
      return Math.abs(actualNum - expectedNum) < 0.0001;
    }

    return false;
  }

  async executeRaw(code: string, language: string): Promise<string> {
    if (!code || !code.trim()) throw new Error('Code cannot be empty');
    if (!language) throw new Error('Language must be specified');

    if (language === 'javascript') {
      // Run JS in a VM and capture console output or return function result
      return new Promise<string>((resolve, reject) => {
        try {
          let captured = '';
          const sandbox: any = {
            console: {
              log: (...args: any[]) => {
                captured += args.map((a) => String(a)).join(' ') + '\n';
              },
            },
          };
          const script = new vm.Script(code);
          const context = vm.createContext(sandbox);
          try {
            script.runInContext(context, { timeout: 5000 });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            reject(new Error(`JavaScript execution error: ${msg}`));
            return;
          }

          // If code defines a top-level function named solution/solve/main, try to call it
          const priority = ['solution', 'solve', 'main'];
          for (const name of priority) {
            if (typeof sandbox[name] === 'function') {
              try {
                const res = sandbox[name]();
                if (res !== undefined && res !== null)
                  resolve(String(res).trim());
                else if (captured) resolve(captured.trim());
                else resolve('');
                return;
              } catch (callErr) {
                const msg =
                  callErr instanceof Error ? callErr.message : String(callErr);
                reject(new Error(`Error calling function '${name}': ${msg}`));
                return;
              }
            }
          }

          // Otherwise prefer captured console output
          if (captured) resolve(captured.trim());
          else resolve('');
        } catch (err) {
          reject(err);
        }
      });
    } else if (language === 'python') {
      // Execute raw python code and return stdout
      return this.executePythonCode(code);
    }

    throw new Error(`Language '${language}' not supported for raw execution`);
  }
}
