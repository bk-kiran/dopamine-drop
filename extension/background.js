'use strict'

// Listen for extension install
chrome.runtime.onInstalled.addListener(() => {
  console.log('dopamine drop extension installed')
})

// Handle messages from content/sidebar if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Future: handle background sync, notifications, etc.
})
