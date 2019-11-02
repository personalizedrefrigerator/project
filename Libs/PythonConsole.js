"use strict";

const PYODIDE_WEB_WORKER_URL = "Pyodide/webworker.js";
const PYTHON_WORKER = new Worker(PYODIDE_WEB_WORKER_URL);

function PythonConsole()
{
    // Create UI.
    let consoleWindow = EditorHelper.openWindowedEditor("... Loading ...");
    let pythonConsoleConnection = { push: (content) => { console.error("NOT INITIALIZED"); } };
    let promptColor = "orange";
    let STDOUT_COLOR = "#00ffff";
    let STDERR_COLOR = "#ffaaaa";
    
    // Get the background worker.
    const pythonWorker = PYTHON_WORKER;
    
    // Note that this is a python console.
    consoleWindow.editControl.setDefaultHighlightScheme("py");
    
    // Handle events from python.
    pythonWorker.onmessage = (event) =>
    {
        const { results, errors } = event.data;
        
        if (onMessageListeners.length > 0)
        {
            // Notify the first.
            if (results || !errors)
            {
                (onMessageListeners[0])(results);
            }
            else
            {
                (onMessageListeners[0])(errors);
            }
            
            onMessageListeners = onMessageListeners.splice(1);
        }
        else
        {
            console.log(results);
            console.warn(errors);
        }
    };
    
    pythonWorker.onerror = (event) =>
    {
        if (onMessageListeners.length > 0)
        {
            onMessageListeners[0]({ filename: event.filename, line: event.lineno,
                                                  message: event.message });
            
            onMessageListeners = onMessageListeners.splice(1);
        }
        else
        {
            console.warn(event.message + " ( " + event.filename + ":" + event.lineno + " ) " );
        }
    };
    
    let onMessageListeners = []; //  A stack of everyone waiting for
                                 // a response from Python.
    
    // Register a listener for events from the python
    //worker. Paramater doNotRejectErrors represents
    //whether to "throw" an exception by calling reject
    //with the content of the error.
    let nextResponsePromise = (doNotRejectErrors) =>
    {
        let result = new Promise((resolve, reject) =>
        {
            console.log("PROMISE CREATED...");
            
            onMessageListeners.push((results, failures) =>
            {
                console.log("LISTENER CALLED: " + results);
                
                resolve(results);
                
                if (failures && !doNotRejectErrors)
                {
                    reject(failures);
                }
            });
        });
        
        return result;
    };
    
    let runPython = (code) =>
    {
        pythonWorker.postMessage(
        {
            python: code
        });
        
        return nextResponsePromise();
    };
    
    window.runPython = runPython;
    
    let handlePyResult = async function()
    {
        let stdoutContent = await runPython("sys.stdout.getvalue()");
        let stderrContent = await runPython("sys.stderr.getvalue()");
        
        if (stdoutContent)
        {
            consoleWindow.displayContent(stdoutContent, (line) =>
            {
                if (!line)
                {
                    return;
                }
                
                line.setColorFunction = (index) =>
                {
                    return STDOUT_COLOR;
                };
            });
        }
        
        if (stderrContent)
        {
            consoleWindow.displayContent(stderrContent, (line) =>
            {
                if (!line)
                {
                    return;
                }
                
                line.setColorFunction = (index) =>
                {
                    return STDERR_COLOR;
                };
            });
        }
    
        requestAnimationFrame(() =>
        {
            consoleWindow.render();
        });
    };
    
    let createPrompt = (promptText) =>
    {    
        promptText = promptText || ">>> ";
        
        let newLine = consoleWindow.editControl.appendLine(promptText);
        
        newLine.setColorFunction = (index) =>
        {
            if (index < promptText.length)
            {
                return promptColor;
            }
        };
        
        newLine.focus();
        newLine.cursorPosition = newLine.text.length;
        consoleWindow.editControl.shiftViewIfNecessary(consoleWindow.editControl.getSelEnd().y);
        
        newLine.onentercommand = () =>
        {
            try
            {
                newLine.onentercommand = undefined;
                newLine.editable = false;
                
                pythonConsoleConnection.push(newLine.text.substring(promptText.length)).then(
                (result) =>
                {
                    console.log(">> RESULT: " + result);
                    if (!result)
                    {
                        handlePyResult().then(() =>
                        {
                            createPrompt(">>> ");
                        });
                    }
                    else
                    {
                        createPrompt("... ");
                    }
                });
            }
            catch(e)
            {
                consoleWindow.displayContent("" + e);
                
                createPrompt(promptText);
            }
        };
        
        // Display changes.
        requestAnimationFrame(() =>
        {
            consoleWindow.render();
        });
    };
    
    runPython("print('Test...')");
    
    // Run python.
    pythonConsoleConnection = 
    {
        push: (code) =>
        {
            requestAnimationFrame(() =>
            {
                pythonWorker.postMessage
                (
                    {
                        __code: code,
                        python: "from js import __code\n_pushCode(__code)"
                    }
                );
            });
            
            console.log("Pushed code: " + code);
            
            return nextResponsePromise();
        }
    };
    
    runPython("print('Welcome to Python!')");
    
    runPython(
        `
import io, code, sys
from js import self, pyodide

class Console(code.InteractiveConsole):
  def runcode(self, code):
      sys.stdout = io.StringIO()
      sys.stderr = io.StringIO()
      sys.stdin  = io.StringIO()
      print(pyodide.runPython("\\n".join(self.buffer)))

_mainConsole = Console(locals=globals())

def _pushCode(code):
  return _mainConsole.push(code)

print ("Loaded.")`);
    
    createPrompt();
}
