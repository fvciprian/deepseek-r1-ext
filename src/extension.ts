import * as vscode from 'vscode';
import ollama from 'ollama';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

let currentPanel: vscode.WebviewPanel | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('deepseek-r1-ext.start', () => {
        if (currentPanel) {
            currentPanel.reveal();
            return;
        }

        currentPanel = vscode.window.createWebviewPanel(
            'deepseek',
            'Deep Seek R1',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        currentPanel.onDidDispose(() => {
            currentPanel = undefined;
        });

        currentPanel.webview.html = getWebviewContent();

        currentPanel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'ask') {
                const prompt = message.prompt.trim();
                
                if (!prompt) {
                    currentPanel?.webview.postMessage({ 
                        command: 'error', 
                        text: 'Please enter a valid prompt' 
                    });
                    return;
                }

                try {
                    currentPanel?.webview.postMessage({ command: 'setLoading', isLoading: true });
                    
                    const streamResponse = await ollama.chat({
                        model: 'deepseek-r1:7b',
                        messages: [{ role: 'user', content: prompt }],
                        stream: true,
                        keep_alive: 0
                    });

                    let responseText = '';
                    for await (const part of streamResponse) {
                        responseText += part.message.content;
                        currentPanel?.webview.postMessage({ 
                            command: 'updateResponse', 
                            text: responseText 
                        });
                    }
                } catch (err) {
                    currentPanel?.webview.postMessage({ 
                        command: 'error', 
                        text: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` 
                    });
                } finally {
                    currentPanel?.webview.postMessage({ command: 'setLoading', isLoading: false });
                }
            }
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    if (currentPanel) {
        currentPanel.dispose();
    }
}

function getWebviewContent(): string {
    return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Deep Seek R1</title>
            <style>
                body { 
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 1rem;
                }
                #prompt { 
                    width: 100%;
                    box-sizing: border-box;
                    padding: 0.5rem;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    resize: vertical;
                }
                #askBtn {
                    margin-top: 0.5rem;
                    padding: 0.5rem 1rem;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    cursor: pointer;
                }
                #askBtn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                #response {
                    border: 1px solid var(--vscode-input-border);
                    padding: 1rem;
                    margin-top: 1rem;
                    white-space: pre-wrap;
                    min-height: 2rem;
                }
                .error { color: var(--vscode-errorForeground); }
                .loading { opacity: 0.7; }
            </style>
        </head>
        <body>
            <h1>DeepSeek R1 Extension</h1>
            <textarea id="prompt" rows="4" placeholder="Ask Something"></textarea>
            <button id="askBtn">Ask</button>
            <div id="response"></div>
            <script>
                const vscode = acquireVsCodeApi();
                const askBtn = document.getElementById('askBtn');
                const responseDiv = document.getElementById('response');
                let isLoading = false;

                document.getElementById('askBtn').addEventListener('click', () => {
                    const prompt = document.getElementById('prompt').value;
                    vscode.postMessage({ command: 'ask', prompt });
                });

                // Add keyboard shortcut
                document.getElementById('prompt').addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        if (!isLoading) {
                            askBtn.click();
                        }
                    }
                });

                window.addEventListener('message', event => {
                    const { command, text, isLoading: loading } = event.data;
                    
                    switch (command) {
                        case 'updateResponse':
                            responseDiv.innerText = text;
                            responseDiv.classList.remove('error');
                            break;
                        case 'error':
                            responseDiv.innerText = text;
                            responseDiv.classList.add('error');
                            break;
                        case 'setLoading':
                            isLoading = loading;
                            askBtn.disabled = loading;
                            responseDiv.classList.toggle('loading', loading);
                            askBtn.innerText = loading ? 'Processing...' : 'Ask';
                            break;
                    }
                });
            </script>
        </body>
        </html>
    `;
}