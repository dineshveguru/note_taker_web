// Popup script to handle the extension's UI and functionality

// Data storage and retrieval functions
const NotesStorage = {
  // Get notes for the current site
  async getSiteNotes() {
    const currentTab = await getCurrentTab();
    const hostname = new URL(currentTab.url).hostname;
    const result = await chrome.storage.local.get(hostname);
    return result[hostname] || [];
  },
  
  // Save a note for the current site
  async saveSiteNote(note) {
    const currentTab = await getCurrentTab();
    const hostname = new URL(currentTab.url).hostname;
    const notes = await this.getSiteNotes();
    notes.push(note);
    
    await chrome.storage.local.set({
      [hostname]: notes
    });
  },
  
  // Delete a site note by index
  async deleteSiteNote(index) {
    const currentTab = await getCurrentTab();
    const hostname = new URL(currentTab.url).hostname;
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

// Helper function to get the current active tab
async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

// UI functions
const UI = {
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
    
    // Set up event listeners for the save buttons
    document.getElementById('save-note').addEventListener('click', async () => {
      const noteInput = document.getElementById('note-input');
      const selectedTextElement = document.getElementById('selected-text');
      
      if (noteInput.value.trim() === '') {
        return;
      }
      
      const note = {
        text: noteInput.value.trim(),
        selectedText: selectedTextElement.textContent.trim(),
        timestamp: Date.now()
      };
      
      await NotesStorage.saveSiteNote(note);
      
      // Clear the input
      noteInput.value = '';
      
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

// When the popup is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Get the selected text from the page
  const currentTab = await getCurrentTab();
  
  // Only try to get selected text if we're on a webpage (not on a chrome:// page)
  if (currentTab.url.startsWith('http')) {
    chrome.tabs.sendMessage(currentTab.id, { action: 'getSelection' });
  }
  
  // Initialize the UI
  UI.init();
});

// Listen for the selected text from the background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'selectedTextResponse') {
    document.getElementById('selected-text').textContent = message.text || 'No text selected';
  }
});