
# Reminder StreamDeck plugin
`Reminder` is a plugin to remind you about things.

## Features
- Code written in pure JavaScript
- Cross-platform (macOS, Windows)
- Click the button to disable the alert
- Fully open source!

<img src="https://github.com/tubededentifrice/streamdeck-reminder/raw/master/screenshot1.png" width="252" />

## Installation
In the Release folder, you can find the file `com.courcelle.reminder.streamDeckPlugin`. If you double-click this file on your machine, Stream Deck will install the plugin.

## Source code
The Sources folder contains the source code of the plugin.
- Change the version of the plugin in `Sources\com.courcelle.reminder.sdPlugin\manifest.json`;
- Build the package for distribution by running `DistributionToolWindows/DistributionTool.exe -b -i Sources/com.courcelle.reminder.sdPlugin -o Release` at the root of the project.