# Note Taker Browser Extension

A lightweight, powerful browser extension that allows you to save notes and annotations on any webpage and retrieve them when you return to the site.

![Note Taker Extension](images/notes.png)

## Features

### Core Functionality

- **Sidebar Interface**: A clean, modern sidebar that slides in from the right side of the browser
- **Selection Capture**: Select text on any webpage and save it with your annotations
- **Site-Specific Notes**: Notes are automatically organized by website for easy retrieval
- **Universal Notes**: Create global notes that appear across all websites
- **Google Open Sans Font**: Modern typography for better readability

### Advanced Features

- **Text Location Memory**: Click on saved notes to automatically scroll to the original text location on the page
- **Location Highlighting**: Text is temporarily highlighted when you navigate to it
- **Real-time Selection Update**: Selection text updates in real-time as you select content with the sidebar open
- **Selection Context Saving**: Stores surrounding text context to improve location finding even if the page changes slightly
- **Multiple Storage Methods**: Uses multiple fallback methods to ensure selections are reliably captured

### User Experience

- **Tabbed Interface**: Easily switch between site-specific and universal notes
- **Visual Indicators**: Clear visual cues show which notes are clickable for navigation
- **Auto-clearing**: Selected text area clears after saving a note
- **Responsive Design**: Adaptive layout that works well across different browser sizes
- **Error Handling**: Robust error handling to prevent crashes and improve reliability

## How It Works

1. **Save Notes with Context**: Select text on a webpage, click the extension icon, add your note, and save it
2. **Automatic Organization**: Notes are automatically organized by website
3. **Easy Navigation**: When you revisit a site, open the extension to see all your notes for that site
4. **Navigate to Selections**: Click on a note with selected text to automatically scroll to that section
5. **Universal Reference**: Create global notes that appear across all websites

## Technical Implementation

### Architecture

- **Modular Design**: Separation of concerns with distinct background, content, and UI scripts
- **Event-Driven Communication**: Uses message passing and events for communication between components
- **Lightweight DOM Operations**: Optimized DOM manipulation to maintain performance
- **Smart Text Finding**: Multi-layered approach to finding text (XPath, context-based search)

### Storage

- **Chrome Storage API**: Uses chrome.storage.local for persistent data storage
- **Site-Specific Organization**: Notes are stored using website hostnames as keys
- **Global Data**: Universal notes stored under a global key

### Performance Optimizations

- **Efficient Text Search**: Uses TreeWalker API for performance when finding text
- **Debouncing**: Prevents excessive operations during selection and scrolling
- **Event Delegation**: Efficient event handling for DOM interactions
- **Minimal Dependencies**: No external libraries required, keeping the extension lightweight

## Installation

### For Development

1. Clone this repository
2. Open Chrome/Edge and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory

### For Users (coming soon)

- Chrome Web Store link (pending publication)
- Firefox Add-ons link (pending publication)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Created with ❤️ for web researchers, students, and anyone who needs to take notes while browsing
- Special thanks to all contributors and users for their feedback and support
