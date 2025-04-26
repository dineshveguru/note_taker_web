// Background script that runs in the extension's service worker

// Listen for installation and setup initial state
chrome.runtime.onInstalled.addListener(() => {
  console.log('Note Taker extension installed');
});

// Listen for browser action click
chrome.action.onClicked.addListener((tab) => {
  // Make sure we're on a valid page (not chrome:// or other protected URLs)
  if (tab.url.startsWith('http')) {
    // Send a message to the content script to toggle the sidebar
    chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' })
      .catch(error => {
        console.log('Error sending message to content script:', error);
        // If the content script isn't ready, inject it
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['js/content.js']
        }).then(() => {
          // Try again after injection
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' })
              .catch(err => {
                console.log('Failed to toggle sidebar after injection:', err);
              });
          }, 200);
        });
      });
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle messages from content scripts
  if (message.action === 'getSelectedText') {
    // Store the selected text temporarily to pass to the sidebar
    chrome.storage.local.set({ 'selectedText': message.text }, () => {
      // Make sure we confirm storage was set
      if (chrome.runtime.lastError) {
        console.error('Error setting selectedText:', chrome.runtime.lastError);
      } else {
        console.log('Selected text saved to storage:', message.text ? message.text.substring(0, 20) + '...' : 'none');
      }
      sendResponse({ success: true });
    });
    return true; // Keep the messaging channel open for the async response
  }
});