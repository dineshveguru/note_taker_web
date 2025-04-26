// Sidebar script to handle the UI and functionality

// Data storage and retrieval functions
const NotesStorage = {
  // Get notes for the current site
  async getSiteNotes() {
    const hostname = await getCurrentHostname();
    const result = await chrome.storage.local.get(hostname);
    return result[hostname] || [];
  },
  
  // Save a note for the current site
  async saveSiteNote(note) {
    const hostname = await getCurrentHostname();
    const notes = await this.getSiteNotes();
    notes.push(note);
    
    await chrome.storage.local.set({
      [hostname]: notes
    });
  },
  
  // Delete a site note by index
  async deleteSiteNote(index) {
    const hostname = await getCurrentHostname();
    const notes = await this.getSiteNotes();
    
    notes.splice(index, 1);
    
    await chrome.storage.local.set({
      [hostname]: notes
    });
  },
  
  // Get all global notes
  async getGlobalNotes() {
    const result = await chrome.storage.local.get('globalNotes');
    return result.globalNotes || [];
  },
  
  // Save a global note
  async saveGlobalNote(note) {
    const notes = await this.getGlobalNotes();
    notes.push(note);
    
    await chrome.storage.local.set({
      globalNotes: notes
    });
  },
  
  // Delete a global note by index
  async deleteGlobalNote(index) {
    const notes = await this.getGlobalNotes();
    
    notes.splice(index, 1);
    
    await chrome.storage.local.set({
      globalNotes: notes
    });
  }
};

// Helper function to get the current hostname
async function getCurrentHostname() {
  try {
    // We can't use getCurrentTab() here because this runs in a separate frame
    // Instead, we'll ask the parent window for the URL
    const parentUrl = document.referrer;
    const url = new URL(parentUrl);
    return url.hostname;
  } catch (error) {
    console.error('Error getting hostname:', error);
    return 'unknown-host';
  }
}

// UI functions
const UI = {
  // Update the selected text display
  updateSelectedText(text) {
    const selectedTextElement = document.getElementById('selected-text');
    if (selectedTextElement) {
      selectedTextElement.textContent = text || 'No text selected';
    }
  },
  
  // Clear the selected text display
  clearSelectedText() {
    this.updateSelectedText('');
    // Also clear from local storage to prevent re-populating
    localStorage.removeItem('note_taker_selected_text');
    // Inform the content script that the selection should be cleared
    window.parent.postMessage({ 
      from: 'note-taker-sidebar', 
      action: 'clearSelection' 
    }, '*');
  },
  
  // Render site notes in the list
  async renderSiteNotes() {
    const siteNotesList = document.getElementById('site-notes-list');
    siteNotesList.innerHTML = '';
    
    const notes = await NotesStorage.getSiteNotes();
    
    if (notes.length === 0) {
      siteNotesList.innerHTML = '<div class="empty-notes">No notes for this site yet.</div>';
      return;
    }
    
    notes.forEach((note, index) => {
      const noteElement = this.createNoteElement(note, index, 'site');
      siteNotesList.appendChild(noteElement);
    });
  },
  
  // Render global notes in the list
  async renderGlobalNotes() {
    const globalNotesList = document.getElementById('global-notes-list');
    globalNotesList.innerHTML = '';
    
    const notes = await NotesStorage.getGlobalNotes();
    
    if (notes.length === 0) {
      globalNotesList.innerHTML = '<div class="empty-notes">No universal notes yet.</div>';
      return;
    }
    
    notes.forEach((note, index) => {
      const noteElement = this.createNoteElement(note, index, 'global');
      globalNotesList.appendChild(noteElement);
    });
  },
  
  // Create a note element for display
  createNoteElement(note, index, type) {
    const noteItem = document.createElement('div');
    noteItem.className = 'note-item';
    
    // Format date
    const date = new Date(note.timestamp);
    const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    
    // Create HTML for the note
    let noteHTML = '';
    
    // Add the quoted text if it exists
    if (note.selectedText) {
      noteHTML += `<div class="note-quote">${note.selectedText}</div>`;
    }
    
    // Add the note text
    noteHTML += `<div class="note-text">${note.text}</div>`;
    
    // Add date and delete button
    noteHTML += `
      <div class="note-date">${formattedDate}</div>
      <div class="note-actions">
        <button class="delete-note" data-index="${index}" data-type="${type}">Delete</button>
      </div>
    `;
    
    noteItem.innerHTML = noteHTML;
    
    // Add event listener for delete button
    noteItem.querySelector('.delete-note').addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent triggering the note click event
      const index = parseInt(e.target.dataset.index);
      const type = e.target.dataset.type;
      
      if (type === 'site') {
        await NotesStorage.deleteSiteNote(index);
        this.renderSiteNotes();
      } else {
        await NotesStorage.deleteGlobalNote(index);
        this.renderGlobalNotes();
      }
    });
    
    // Add click event to the note item for scrolling to the text (only for site notes with selected text)
    if (type === 'site' && note.selectedText) {
      noteItem.classList.add('clickable-note');
      noteItem.addEventListener('click', () => {
        // Send a message to the content script to find and scroll to the text
        window.parent.postMessage({
          from: 'note-taker-sidebar',
          action: 'scrollToText',
          text: note.selectedText,
          selectionInfo: note.selectionInfo || {}
        }, '*');
      });
    }
    
    return noteItem;
  },
  
  // Set up tab navigation
  setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Remove active class from all buttons and tabs
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked button and corresponding tab
        button.classList.add('active');
        const tabId = button.dataset.tab;
        document.getElementById(tabId).classList.add('active');
      });
    });
  },
  
  // Initialize the UI
  init() {
    this.setupTabs();
    this.renderSiteNotes();
    this.renderGlobalNotes();
    
    // Set up close button
    document.getElementById('close-sidebar').addEventListener('click', () => {
      // Send message to parent window to close the sidebar
      window.parent.postMessage({ from: 'note-taker-sidebar', action: 'close' }, '*');
    });
    
    // Set up event listeners for the save buttons
    document.getElementById('save-note').addEventListener('click', async () => {
      const noteInput = document.getElementById('note-input');
      const selectedTextElement = document.getElementById('selected-text');
      
      if (noteInput.value.trim() === '') {
        return;
      }
      
      // Get selection position information from localStorage
      let selectionInfo = {};
      try {
        const storedSelectionInfo = localStorage.getItem('note_taker_selection_info');
        if (storedSelectionInfo) {
          selectionInfo = JSON.parse(storedSelectionInfo);
        }
      } catch (error) {
        console.error('Error parsing selection info:', error);
      }
      
      const note = {
        text: noteInput.value.trim(),
        selectedText: selectedTextElement.textContent.trim() !== 'No text selected' ? 
                      selectedTextElement.textContent.trim() : '',
        timestamp: Date.now(),
        // Store selection info for finding the text later
        selectionInfo: selectionInfo
      };
      
      await NotesStorage.saveSiteNote(note);
      
      // Clear the input and selected text
      noteInput.value = '';
      this.clearSelectedText(); // Clear selected text after saving
      
      // Re-render the notes
      this.renderSiteNotes();
    });
    
    document.getElementById('save-global-note').addEventListener('click', async () => {
      const globalNoteInput = document.getElementById('global-note-input');
      
      if (globalNoteInput.value.trim() === '') {
        return;
      }
      
      const note = {
        text: globalNoteInput.value.trim(),
        timestamp: Date.now()
      };
      
      await NotesStorage.saveGlobalNote(note);
      
      // Clear the input
      globalNoteInput.value = '';
      
      // Re-render the notes
      this.renderGlobalNotes();
    });
  }
};

// Attempt to retrieve selected text using multiple methods
async function loadSelectedText() {
  let selectedText = '';
  
  // Method 1: Try getting from chrome.storage.local
  try {
    const result = await chrome.storage.local.get('selectedText');
    if (result.selectedText) {
      selectedText = result.selectedText;
      console.log('Retrieved selected text from storage:', selectedText.substring(0, 20) + '...');
      // Update the UI with the text
      UI.updateSelectedText(selectedText);
      // Clear the temporary storage
      chrome.storage.local.remove('selectedText');
      return;
    }
  } catch (error) {
    console.error('Error reading from chrome.storage:', error);
  }
  
  // Method 2: Try getting from localStorage (set by content script)
  try {
    const localText = localStorage.getItem('note_taker_selected_text');
    if (localText) {
      selectedText = localText;
      console.log('Retrieved selected text from localStorage:', selectedText.substring(0, 20) + '...');
      UI.updateSelectedText(selectedText);
      return;
    }
  } catch (error) {
    console.error('Error reading from localStorage:', error);
  }
  
  // Method 3: Ask the parent window (content script) directly
  try {
    window.parent.postMessage({ 
      from: 'note-taker-sidebar', 
      action: 'getSelectedText' 
    }, '*');
  } catch (error) {
    console.error('Error requesting text from parent window:', error);
    // If all else fails, show that no text is selected
    UI.updateSelectedText('');
  }
}

// Listen for messages from the parent window (content script)
window.addEventListener('message', (event) => {
  // Check if the message is from our content script
  if (event.data && event.data.from === 'note-taker-content') {
    if (event.data.action === 'updateSelectedText') {
      UI.updateSelectedText(event.data.text);
    }
  }
});

// When the sidebar is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Try to get the selected text from various sources
  await loadSelectedText();
  
  // Initialize the UI
  UI.init();
  
  // Set up a mechanism to periodically check for selection updates
  // This helps in cases where the sidebar loads before the text is stored
  let retryCount = 0;
  const maxRetries = 3;
  
  const checkForTextUpdates = setInterval(async () => {
    const currentText = document.getElementById('selected-text').textContent;
    if (currentText === 'No text selected' && retryCount < maxRetries) {
      await loadSelectedText();
      retryCount++;
    } else {
      clearInterval(checkForTextUpdates);
    }
  }, 500);
});