import * as vscode from 'vscode';
import ollama from 'ollama'; // Import ollama API

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const disposable = vscode.commands.registerCommand('deepseek-r1-ext.start', () => {
		const panel = vscode.window.createWebviewPanel(
			'deepseek',
			'Deep Seek R1',
			vscode.ViewColumn.One,
			{
				enableScripts: true
			}
		);

		panel.webview.html = getWebviewContent();

		panel.webview.onDidReceiveMessage(async (message) => {
			if(message.command === 'ask') {
				const prompt = message.prompt;
				let responseText = '';

				try{
					const streamResponse = await ollama.chat({
						model:'deepseek-r1:7b',
						messages: [{role: 'user', content: prompt}],
						stream: true,
						keep_alive: 0
					});

					for await (const part of streamResponse){
						responseText += part.message.content;
						panel.webview.postMessage({ command: 'askResponse', text: responseText });
					}

				} catch(err){
					panel.webview.postMessage({ command: 'askResponse', text: 'Error: ' + err });
				}
			}
		});
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {
	
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
				body { font-family: sans-serif, margin: 1rem; }
				#prompt { width:100%; box-sizing: border-box; padding: 0.5rem; }
				#response { border: 1px solid #ccc; padding: 0.5rem; margin-top: 0.5rem; }
			</style>
		</head>
		<body>
			<h1>DeepSeek R1 Extension</h1>
			<textarea id="prompt" rows="3" placeholder="Ask Something"></textarea> <br />
			<button id="askBtn">Ask</button>
			<div id="response"></div>
			<script>
				const vscode = acquireVsCodeApi();
				
				document.getElementById('askBtn').addEventListener('click', () => {
					const prompt = document.getElementById('prompt').value;
					vscode.postMessage({ command: 'ask', prompt });
				});

				window.addEventListener('message', event => {
					const { command, text } = event.data;
					if(command === 'askResponse'){
						document.getElementById('response').innerText = text;
					}
				});

			</script>
		</body>
		</html>
	`;
}

