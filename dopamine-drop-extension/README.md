# Dopamine Drop Chrome Extension

A productivity sidebar for Canvas LMS that tracks assignments, builds streaks, and gamifies your studies.

## Features

- 📊 **Stats Dashboard** - View your total points and current streak at a glance
- 🚨 **Urgent Tasks** - See assignments due within 24 hours
- 📚 **Upcoming View** - Track assignments due within the next 7 days
- 🎯 **Daily Challenges** - Complete special challenges for bonus points
- 🔄 **Auto Sync** - Automatically syncs with Canvas every 15 minutes
- 🎨 **Beautiful UI** - Dark gradient theme with smooth animations
- 🔌 **Seamless Integration** - Replaces Canvas's default widgets in the right sidebar

## Installation

### From Source (Development)

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `dopamine-drop-extension` folder

### Configuration

After installing:

1. Navigate to any Canvas LMS page with a right sidebar (e.g., Dashboard, Course pages)
2. The Dopamine Drop sidebar will automatically appear, replacing Canvas's default widgets
3. Click "Sync Now" to refresh your assignments
4. (Optional) Add your Canvas API token via the extension for enhanced sync functionality

## How to Get Your Canvas API Token

1. Log into your Canvas LMS
2. Go to Account → Settings
3. Scroll down to "Approved Integrations"
4. Click "+ New Access Token"
5. Give it a name (e.g., "Dopamine Drop Extension")
6. Click "Generate Token"
7. Copy the token and save it in the extension settings

## Usage

1. **Navigate to Canvas**: The sidebar automatically appears in Canvas's right sidebar
2. **View Stats**: See your points and streak in the top cards
3. **Check Tasks**: Scroll through urgent and upcoming assignments
4. **Sync Data**: Click "Sync Now" to refresh from Canvas
5. **Complete Tasks**: Click any task to open it in Canvas

**Note**: The sidebar replaces Canvas's default "To Do" and "Coming Up" widgets with a more powerful gamified version.

## File Structure

```
dopamine-drop-extension/
├── manifest.json           # Extension configuration (Manifest V3)
├── content/
│   ├── content.js         # Content script (injects sidebar)
│   └── content.css        # Sidebar container styles
├── sidebar/
│   ├── sidebar.html       # Sidebar UI structure
│   ├── sidebar.js         # Sidebar logic
│   └── sidebar.css        # Sidebar component styles
├── background/
│   └── background.js      # Service worker (handles icon clicks, alarms)
├── utils/
│   ├── storage.js         # Chrome storage helpers
│   └── canvas-api.js      # Canvas API integration
└── assets/
    └── icons/             # Extension icons (16, 48, 128px)
```

## Permissions

- `storage` - Store user data and sync status locally
- `activeTab` - Access current Canvas tab to inject sidebar
- `https://*.instructure.com/*` - Access Canvas LMS domains

## Development

### Building Icons

Icons are 16x16, 48x48, and 128x128 PNG files with:
- Purple gradient background (#a855f7 to #6366f1)
- White "DD" text in bold sans-serif font
- Saved in `assets/icons/` as `icon-16.png`, `icon-48.png`, `icon-128.png`

### Testing

1. Load extension in Chrome
2. Navigate to any Canvas page
3. Click extension icon to toggle sidebar
4. Check console for any errors
5. Test sync functionality

### Debugging

- Check extension console: Right-click extension icon → Inspect popup (for service worker)
- Check content script console: Open DevTools on Canvas page
- Check sidebar console: Right-click inside sidebar → Inspect

## Roadmap

- [ ] Full Canvas API integration with OAuth
- [ ] Streak protection shields
- [ ] Reward system with unlockable themes
- [ ] Leaderboard integration
- [ ] Custom task creation from extension
- [ ] Desktop notifications for urgent tasks

## License

MIT License - See LICENSE file for details

## Support

For issues or feature requests, please open an issue on GitHub.
