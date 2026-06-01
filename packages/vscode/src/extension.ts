import * as vscode from 'vscode';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

let statusBar: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function getCli(): string {
  return vscode.workspace.getConfiguration('codepulse').get<string>('cliPath', 'codepulse');
}

function isIndexed(root: string): boolean {
  return existsSync(join(root, '.codepulse', 'index.db'));
}

function runCli(args: string[], root: string): string {
  const cli = getCli();
  return execSync(`${cli} ${args.join(' ')}`, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function updateStatusBar(): void {
  const root = getWorkspaceRoot();
  if (!root) {
    statusBar.hide();
    return;
  }

  if (!isIndexed(root)) {
    statusBar.text = '$(pulse) CodePulse: Not indexed';
    statusBar.tooltip = 'Click to index this project';
    statusBar.command = 'codepulse.indexProject';
    statusBar.backgroundColor = undefined;
    statusBar.show();
    return;
  }

  try {
    const raw = runCli(['status', '--json'], root);
    const status = JSON.parse(raw) as {
      indexed: boolean;
      commitsBehind: number;
      totalFiles: number;
      totalSymbols: number;
    };

    if (!status.indexed) {
      statusBar.text = '$(pulse) CodePulse: Not indexed';
      statusBar.command = 'codepulse.indexProject';
      statusBar.backgroundColor = undefined;
    } else if (status.commitsBehind > 0) {
      statusBar.text = `$(warning) CodePulse: ${status.commitsBehind} behind`;
      statusBar.tooltip = `Index is ${status.commitsBehind} commit(s) behind HEAD. Click to update.`;
      statusBar.command = 'codepulse.updateIndex';
      statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      statusBar.text = `$(check) CodePulse: ${status.totalFiles} files`;
      statusBar.tooltip = `Index up to date — ${status.totalFiles} files, ${status.totalSymbols} symbols`;
      statusBar.command = 'codepulse.showStatus';
      statusBar.backgroundColor = undefined;
    }
    statusBar.show();
  } catch {
    statusBar.text = '$(pulse) CodePulse';
    statusBar.tooltip = 'CodePulse — click for status';
    statusBar.command = 'codepulse.showStatus';
    statusBar.show();
  }
}

async function indexProject(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'CodePulse: Indexing project…', cancellable: false },
    async () => {
      try {
        runCli(['init', '--root', root], root);
        updateStatusBar();
        vscode.window.showInformationMessage('CodePulse: Index complete.');
      } catch (e) {
        vscode.window.showErrorMessage(`CodePulse index failed: ${String(e)}`);
      }
    }
  );
}

async function updateIndex(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'CodePulse: Updating index…', cancellable: false },
    async () => {
      try {
        runCli(['update', '--root', root], root);
        updateStatusBar();
        vscode.window.showInformationMessage('CodePulse: Index updated.');
      } catch (e) {
        vscode.window.showErrorMessage(`CodePulse update failed: ${String(e)}`);
      }
    }
  );
}

async function copyContext(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;

  if (!isIndexed(root)) {
    const choice = await vscode.window.showWarningMessage(
      'CodePulse: Project not indexed.',
      'Index Now'
    );
    if (choice === 'Index Now') await indexProject();
    return;
  }

  const format = vscode.workspace.getConfiguration('codepulse').get<string>('contextFormat', 'xml');

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'CodePulse: Generating context…', cancellable: false },
    async () => {
      try {
        const context = runCli(['context', '--auto', '--format', format, '--root', root], root);
        await vscode.env.clipboard.writeText(context.trim());
        // Count rough token estimate from output length
        const tokens = Math.round(context.length / 4);
        vscode.window.showInformationMessage(`CodePulse: Context copied (~${tokens} tokens)`);
      } catch (e) {
        vscode.window.showErrorMessage(`CodePulse context failed: ${String(e)}`);
      }
    }
  );
}

async function showBlastRadius(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;

  const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
  if (!activeFile) {
    vscode.window.showWarningMessage('CodePulse: Open a file first to see its blast radius.');
    return;
  }

  if (!isIndexed(root)) {
    vscode.window.showWarningMessage('CodePulse: Project not indexed. Run CodePulse: Index Project first.');
    return;
  }

  try {
    const relFile = activeFile.replace(root + '/', '');
    const output = runCli(['blast-radius', relFile, '--root', root], root);
    outputChannel.clear();
    outputChannel.appendLine(output);
    outputChannel.show(true);
  } catch (e) {
    vscode.window.showErrorMessage(`CodePulse blast-radius failed: ${String(e)}`);
  }
}

function showStatus(): void {
  const root = getWorkspaceRoot();
  if (!root) return;

  try {
    const output = isIndexed(root)
      ? runCli(['status', '--root', root], root)
      : 'Not indexed. Run CodePulse: Index Project first.';
    outputChannel.clear();
    outputChannel.appendLine(output);
    outputChannel.show(true);
  } catch (e) {
    vscode.window.showErrorMessage(`CodePulse status failed: ${String(e)}`);
  }
}

function installHooks(): void {
  const root = getWorkspaceRoot();
  if (!root) return;

  try {
    runCli(['install-hooks', '--root', root], root);
    vscode.window.showInformationMessage('CodePulse: Git hooks installed. Index will auto-update after each commit.');
  } catch (e) {
    vscode.window.showErrorMessage(`CodePulse install-hooks failed: ${String(e)}`);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('CodePulse');
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  context.subscriptions.push(outputChannel, statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand('codepulse.indexProject', indexProject),
    vscode.commands.registerCommand('codepulse.updateIndex', updateIndex),
    vscode.commands.registerCommand('codepulse.copyContext', copyContext),
    vscode.commands.registerCommand('codepulse.showBlastRadius', showBlastRadius),
    vscode.commands.registerCommand('codepulse.showStatus', showStatus),
    vscode.commands.registerCommand('codepulse.installHooks', installHooks),
  );

  // Refresh status bar when workspace changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => updateStatusBar())
  );

  // Auto-update on save if enabled
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const root = getWorkspaceRoot();
      if (!root || !isIndexed(root)) return;
      if (!vscode.workspace.getConfiguration('codepulse').get<boolean>('autoUpdateOnSave', false)) return;
      try {
        runCli(['update', '--root', root], root);
        updateStatusBar();
      } catch { /* silent */ }
    })
  );

  updateStatusBar();
}

export function deactivate(): void {
  statusBar?.dispose();
  outputChannel?.dispose();
}
