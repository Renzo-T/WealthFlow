WealthFlow
==========

A personal finance dashboard that runs on this computer. Your data stays here, in a database in your user's
app-data folder (%LOCALAPPDATA%\WealthFlow). Nothing else needs installing.

Start
-----
1. Move this WealthFlow folder somewhere permanent, e.g. your Documents folder.
2. Double-click WealthFlow.cmd. It opens WealthFlow in your browser.
   If Windows asks whether to run it ("Windows protected your PC"), choose More info > Run anyway.
   It's unsigned because signing costs money, not because anything is wrong.
3. Paste your Plaid keys when asked. The screen explains how to get them (a free Plaid account).
4. Connect your banks.

In Settings > App you can:
- Install WealthFlow, so it opens in its own window from the Start menu or taskbar (Chrome or Edge).
- Start WealthFlow when I sign in, so it opens straight away and keeps your banks up to date in the background.
- Let the app window start WealthFlow, so the installed app's shortcut shows a Start button when WealthFlow isn't running.
- Stop WealthFlow.

Update to a newer version
-------------------------
Settings > App > Stop WealthFlow, replace this folder with the new one, and double-click WealthFlow.cmd.
Your data and keys are kept (they live in %LOCALAPPDATA%\WealthFlow). If "Start when I sign in" was on and the folder
moved, turn it off and on again.

Back up
-------
Settings > Backup. Keep a copy of config.json from %LOCALAPPDATA%\WealthFlow too: it holds the key your bank
connections are encrypted with.

Remove
------
Turn off "Start WealthFlow when I sign in" and "Let the app window start WealthFlow", stop WealthFlow, then delete this folder and %LOCALAPPDATA%\WealthFlow.

If something goes wrong
-----------------------
%LOCALAPPDATA%\WealthFlow\app.log has WealthFlow's messages from its last start.
Bundled Node.js: see NODE-LICENSE.txt.
