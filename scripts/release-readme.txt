Mizo Money
==========

A personal finance dashboard that runs on this computer. Your data stays here, in a database in your user's
app-data folder (%LOCALAPPDATA%\Mizo Money). Nothing else needs installing.

Start
-----
1. Move this Mizo Money folder somewhere permanent, e.g. your Documents folder.
2. Double-click Mizo Money.cmd. It opens Mizo Money in your browser.
   If Windows asks whether to run it ("Windows protected your PC"), choose More info > Run anyway. Windows asks about
   scripts from downloads that carry no publisher signature (Mizo Money.cmd is a script and can't carry one). It only
   asks the first time: once running, Mizo Money tells Windows it's fine, and starting at sign-in never asks.
3. Paste your Plaid keys when asked. The screen explains how to get them (a free Plaid account).
4. Connect your banks.

In Settings > App you can:
- Install Mizo Money, so it opens in its own window from the Start menu or taskbar (Chrome or Edge).
- Start Mizo Money when I sign in, so it opens straight away and keeps your banks up to date in the background.
- Let the app window start Mizo Money, so the installed app's shortcut shows a Start button when Mizo Money isn't running.
- Stop Mizo Money.

Update to a newer version
-------------------------
Mizo Money tells you when a new version is out (top bar, and Settings > Updates, with a Download button).
Settings > App > Stop Mizo Money, replace this folder with the new one, and double-click Mizo Money.cmd.
Your data and keys are kept (they live in %LOCALAPPDATA%\Mizo Money). If "Start when I sign in" was on and the folder
moved, turn it off and on again.

Back up
-------
Settings > Backup. Keep a copy of config.json from %LOCALAPPDATA%\Mizo Money too: it holds the key your bank
connections are encrypted with.

Remove
------
Turn off "Start Mizo Money when I sign in" and "Let the app window start Mizo Money", stop Mizo Money, then delete this folder and %LOCALAPPDATA%\Mizo Money.

If something goes wrong
-----------------------
%LOCALAPPDATA%\Mizo Money\app.log has Mizo Money's messages from its last start.
Bundled Node.js: see NODE-LICENSE.txt.
