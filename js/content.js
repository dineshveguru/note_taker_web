// Content script that runs in the context of web pages
// This script handles interaction with the web page content and sidebar injection

let sidebarInjected = false;
let sidebar = null;
let selectedText = "";
let selectionInfo = {};
let isSelectionTrackerActive = false;

// Create and inject the sidebar into the page
function createSidebar() {
  if (sidebarInjected) return;
  
  // Create sidebar iframe container
  sidebar = document.createElement('iframe');
  sidebar.className = 'note-taker-sidebar';
  sidebar.src = chrome.runtime.getURL('sidebar.html');
  sidebar.style.position = 'fixed';
  sidebar.style.top = '0';
  sidebar.style.right = '-400px';
  sidebar.style.width = '350px';
  sidebar.style.height = '100%';
  sidebar.style.border = 'none';
  sidebar.style.zIndex = '2147483647'; // Max z-index
  sidebar.style.transition = 'right 0.3s ease-in-out';
  sidebar.style.boxShadow = '-5px 0 15px rgba(0, 0, 0, 0.1)';
  
  document.body.appendChild(sidebar);
  sidebarInjected = true;
}

// Toggle the sidebar visibility
function toggleSidebar() {
  // Capture text immediately when the extension is clicked
  captureSelectedText();
  
  if (!sidebarInjected) {
    createSidebar();
    // Wait for the sidebar to be fully created before showing it
    setTimeout(() => {
      sidebar.style.right = '0';
      // Start actively tracking selection changes while sidebar is open
      startSelectionTracker();
      // Tell the sidebar about the selection via postMessage once it's loaded
      sendSelectedTextToSidebar();
    }, 100);
  } else {
    if (sidebar.style.right === '0px') {
      sidebar.style.right = '-400px';
      stopSelectionTracker();
    } else {
      sidebar.style.right = '0';
      startSelectionTracker();
      // Tell the sidebar about the selection
      sendSelectedTextToSidebar();
    }
  }
}

// Start actively tracking selection changes
function startSelectionTracker() {
  if (isSelectionTrackerActive) return;
  
  isSelectionTrackerActive = true;
  
  // Track selection changes more aggressively while sidebar is open
  document.addEventListener('mouseup', handleSelectionChange);
  document.addEventListener('keyup', handleSelectionChange);
  document.addEventListener('selectionchange', handleSelectionChange);
}

// Stop tracking selection changes when sidebar is closed
function stopSelectionTracker() {
  if (!isSelectionTrackerActive) return;
  
  isSelectionTrackerActive = false;
  
  document.removeEventListener('mouseup', handleSelectionChange);
  document.removeEventListener('keyup', handleSelectionChange);
  document.removeEventListener('selectionchange', handleSelectionChange);
}

// Handler for selection changes
function handleSelectionChange() {
  // Only capture if we're not in an input or textarea
  if (document.activeElement?.tagName !== 'TEXTAREA' && 
      document.activeElement?.tagName !== 'INPUT') {
    
    setTimeout(() => {
      captureSelectedText();
      sendSelectedTextToSidebar();
    }, 50); // Small delay to ensure selection is complete
  }
}

// Get the selected text from the page and store selection information
function captureSelectedText() {
  const selection = window.getSelection();
  if (!selection) return;
  
  selectedText = selection.toString().trim();
  
  // Store selection info for scrolling back to it later
  if (selectedText && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const startNode = range.startContainer;
    
    // Get a relative XPath to the start node
    selectionInfo = {
      xpath: getXPath(startNode.nodeType === Node.TEXT_NODE ? startNode.parentNode : startNode),
      textOffset: range.startOffset,
      text: selectedText,
      // Store some context for better matching
      contextBefore: getContextBefore(range, 50),
      contextAfter: getContextAfter(range, 50)
    };
    
    // Store selection info in localStorage for the sidebar to access
    localStorage.setItem('note_taker_selection_info', JSON.stringify(selectionInfo));
  }
  
  // Always store selection in local storage regardless of whether it's empty or not
  chrome.runtime.sendMessage({
    action: 'getSelectedText',
    text: selectedText
  }).catch(error => {
    console.log('Error sending selected text to background:', error);
  });
  
  // Also store it locally for direct communication with the sidebar
  localStorage.setItem('note_taker_selected_text', selectedText);
}

// Get some context before the selection
function getContextBefore(range, maxLength) {
  try {
    const tempRange = range.cloneRange();
    tempRange.setStart(tempRange.startContainer, Math.max(0, tempRange.startOffset - maxLength));
    tempRange.setEnd(range.startContainer, range.startOffset);
    return tempRange.toString();
  } catch (e) {
    return '';
  }
}

// Get some context after the selection
function getContextAfter(range, maxLength) {
  try {
    const tempRange = range.cloneRange();
    const endContainer = range.endContainer;
    const maxEnd = endContainer.nodeType === Node.TEXT_NODE ? endContainer.length : endContainer.childNodes.length;
    
    tempRange.setStart(range.endContainer, range.endOffset);
    tempRange.setEnd(range.endContainer, Math.min(maxEnd, range.endOffset + maxLength));
    return tempRange.toString();
  } catch (e) {
    return '';
  }
}

// Get XPath for an element
function getXPath(element) {
  if (!element) return '';
  
  // For text nodes, use the parent element
  if (element.nodeType === Node.TEXT_NODE) {
    element = element.parentNode;
  }
  
  // Only care about elements
  if (element.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }
  
  // Build a more robust yet simple path
  let path = '';
  while (element && element !== document.body && element !== document.documentElement) {
    let sibling = element;
    let siblingCount = 1;
    
    // Count siblings with same tag name
    while (sibling = sibling.previousElementSibling) {
      if (sibling.tagName === element.tagName) {
        siblingCount++;
      }
    }
    
    // Build path part
    let tagName = element.tagName.toLowerCase();
    let idAttr = element.getAttribute('id');
    
    // If element has an id, use that (it's most reliable)
    if (idAttr && idAttr.length > 0) {
      path = `//${tagName}[@id="${idAttr}"]${path ? '/' + path : ''}`;
      break; // ID should be unique, so we can stop here
    } else {
      // Otherwise, use position
      sibling = element;
      let position = 1;
      
      while (sibling = sibling.previousElementSibling) {
        position++;
      }
      
      path = `/${tagName}[${position}]${path ? '/' + path : ''}`;
    }
    
    element = element.parentNode;
  }
  
  return path;
}

// Find an element by XPath
function getElementByXPath(xpath) {
  try {
    return document.evaluate(
      xpath, 
      document, 
      null, 
      XPathResult.FIRST_ORDERED_NODE_TYPE, 
      null
    ).singleNodeValue;
  } catch (e) {
    console.error('Error evaluating XPath:', e);
    return null;
  }
}

// Clear the current selection
function clearSelection() {
  if (window.getSelection) {
    window.getSelection().removeAllRanges();
  }
  selectedText = "";
  selectionInfo = {};
  localStorage.removeItem('note_taker_selected_text');
  localStorage.removeItem('note_taker_selection_info');
}

// Find text in document and scroll to it
function findAndScrollToText(text, selectionInfo) {
  // Check if text is valid
  if (!text || text.trim() === '') {
    console.warn('No text provided to scroll to');
    return;
  }

  // Debounce to avoid performance issues
  if (window._scrollingTimeout) {
    clearTimeout(window._scrollingTimeout);
  }
  
  window._scrollingTimeout = setTimeout(() => {
    try {
      let foundElement = null;
      let foundRange = null;
      
      // Method 1: Try using stored XPath if available
      if (selectionInfo && selectionInfo.xpath) {
        foundElement = getElementByXPath(selectionInfo.xpath);
        
        if (foundElement) {
          // Try to find the exact text within this element
          foundRange = findTextInElement(foundElement, text, selectionInfo);
        }
      }
      
      // Method 2: Fallback to searching the entire document if XPath didn't work
      if (!foundRange) {
        foundRange = findTextInDocument(text, selectionInfo);
      }
      
      // If found, scroll to it
      if (foundRange) {
        // Create a temporary marker
        const marker = document.createElement('span');
        marker.className = 'note-taker-highlight';
        marker.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
        marker.style.transition = 'background-color 0.5s ease-in-out';
        
        // Clone the range to avoid modifying the original document structure
        const tempRange = foundRange.cloneRange();
        tempRange.surroundContents(marker);
        
        // Scroll to the marker
        marker.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
        
        // Flash the highlight briefly
        setTimeout(() => {
          marker.style.backgroundColor = 'rgba(255, 255, 0, 0.7)';
          
          // Remove the highlight after a delay
          setTimeout(() => {
            // Safely remove the marker
            if (marker.parentNode) {
              // Replace the marker with its content
              const parent = marker.parentNode;
              while (marker.firstChild) {
                parent.insertBefore(marker.firstChild, marker);
              }
              parent.removeChild(marker);
            }
          }, 2000);
        }, 100);
      } else {
        console.warn('Text not found in document:', text);
      }
    } catch (error) {
      console.error('Error during scroll to text:', error);
    }
  }, 100); // Small delay for debouncing
}

// Find text within a specific element
function findTextInElement(element, text, selectionInfo) {
  if (!element || !text) return null;
  
  // Create a TreeWalker to iterate through text nodes
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  const textToFind = text.trim();
  let textNode = walker.nextNode();
  
  while (textNode) {
    const content = textNode.nodeValue;
    
    // Skip null or empty content
    if (!content) {
      textNode = walker.nextNode();
      continue;
    }
    
    const index = content.indexOf(textToFind);
    
    if (index >= 0) {
      // Create a range for this text
      const range = document.createRange();
      range.setStart(textNode, index);
      range.setEnd(textNode, index + textToFind.length);
      return range;
    }
    
    textNode = walker.nextNode();
  }
  
  return null;
}

// Find text anywhere in the document, optimized for performance
function findTextInDocument(text, selectionInfo) {
  if (!text) return null;
  
  // Use context if available for better accuracy
  let contextBefore = selectionInfo?.contextBefore || '';
  let contextAfter = selectionInfo?.contextAfter || '';
  let textToFind = text.trim();
  
  // Use a TreeWalker to efficiently iterate through text nodes
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip null nodes
        if (!node || !node.nodeValue) return NodeFilter.FILTER_SKIP;
        
        // Skip tiny text nodes, hidden elements, and script/style tags
        if (node.nodeValue.trim().length < 2) return NodeFilter.FILTER_SKIP;
        
        const parent = node.parentNode;
        if (!parent) return NodeFilter.FILTER_SKIP;
        
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden' || 
            parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') {
          return NodeFilter.FILTER_SKIP;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    },
    false
  );
  
  // First try with context if available
  if (contextBefore || contextAfter) {
    let bestMatch = null;
    let highestScore = 0;
    
    // Iterate through text nodes
    let textNode = walker.nextNode();
    while (textNode) {
      const content = textNode.nodeValue;
      
      // Skip null content
      if (!content) {
        textNode = walker.nextNode();
        continue;
      }
      
      const index = content.indexOf(textToFind);
      
      if (index >= 0) {
        // Calculate match score based on surrounding context
        let score = 1;
        
        // Check context before
        if (contextBefore && index >= contextBefore.length) {
          const actualBefore = content.substring(index - contextBefore.length, index);
          score += calculateSimilarity(contextBefore, actualBefore) * 5;
        }
        
        // Check context after
        if (contextAfter && index + textToFind.length + contextAfter.length <= content.length) {
          const actualAfter = content.substring(index + textToFind.length, 
                                               index + textToFind.length + contextAfter.length);
          score += calculateSimilarity(contextAfter, actualAfter) * 5;
        }
        
        if (score > highestScore) {
          highestScore = score;
          
          // Create a range for this text
          const range = document.createRange();
          range.setStart(textNode, index);
          range.setEnd(textNode, index + textToFind.length);
          bestMatch = range;
          
          // If score is very high, this is probably the correct match
          if (score > 2) {
            break;
          }
        }
      }
      
      textNode = walker.nextNode();
    }
    
    if (bestMatch) {
      return bestMatch;
    }
  }
  
  // Fallback to simple text search
  let textNode = walker.currentNode ? walker.currentNode : walker.nextNode();
  
  while (textNode) {
    const content = textNode.nodeValue;
    
    // Skip null content
    if (!content) {
      textNode = walker.nextNode();
      continue;
    }
    
    const index = content.indexOf(textToFind);
    
    if (index >= 0) {
      // Create a range for this text
      const range = document.createRange();
      range.setStart(textNode, index);
      range.setEnd(textNode, index + textToFind.length);
      return range;
    }
    
    textNode = walker.nextNode();
  }
  
  return null;
}

// Simple text similarity function (Levenshtein-based but simplified for performance)
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  // For very short texts, direct comparison
  if (str1.length < 10 || str2.length < 10) {
    return str1 === str2 ? 1 : 0;
  }
  
  // For longer texts, check for common substrings
  const len1 = str1.length;
  const len2 = str2.length;
  let matches = 0;
  
  for (let i = 0; i < Math.min(len1, len2); i++) {
    if (str1[i] === str2[i]) matches++;
  }
  
  return matches / Math.max(len1, len2);
}

// Send the selected text directly to the sidebar via postMessage
function sendSelectedTextToSidebar() {
  if (!sidebar || !sidebar.contentWindow) return;
  
  // Use both approaches for redundancy
  // 1. Try to send directly via postMessage
  setTimeout(() => {
    try {
      sidebar.contentWindow.postMessage({
        from: 'note-taker-content',
        action: 'updateSelectedText',
        text: selectedText || ''
      }, '*');
    } catch (err) {
      console.log('Error sending message to sidebar:', err);
    }
  }, 200); // Give a bit of time for the iframe to load
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleSidebar') {
    toggleSidebar();
    sendResponse({ success: true });
  } else if (message.action === 'getSelection') {
    captureSelectedText();
    sendResponse({ success: true, text: selectedText });
  } else if (message.action === 'closeSidebar') {
    if (sidebar) {
      sidebar.style.right = '-400px';
      stopSelectionTracker();
    }
    sendResponse({ success: true });
  }
  return true;
});

// Handle communication with the sidebar iframe
window.addEventListener('message', (event) => {
  // Ensure the message is from our sidebar
  if (event.data && event.data.from === 'note-taker-sidebar') {
    if (event.data.action === 'close') {
      if (sidebar) {
        sidebar.style.right = '-400px';
        stopSelectionTracker();
      }
    } else if (event.data.action === 'getSelectedText') {
      // The sidebar is requesting the selected text
      event.source.postMessage({
        from: 'note-taker-content',
        action: 'updateSelectedText',
        text: selectedText || ''
      }, '*');
    } else if (event.data.action === 'clearSelection') {
      // Clear the selection when requested (after saving a note)
      clearSelection();
    } else if (event.data.action === 'scrollToText') {
      // Find and scroll to the text in the saved note
      findAndScrollToText(event.data.text, event.data.selectionInfo);
    }
  }
});

// When page loads, listen for selection changes to capture them immediately
document.addEventListener('selectionchange', () => {
  // Store the current selection so it's ready when the extension is clicked
  if (document.activeElement?.tagName !== 'TEXTAREA' && 
      document.activeElement?.tagName !== 'INPUT') {
    selectedText = window.getSelection().toString().trim();
  }
});

// Create the sidebar when the content script loads
createSidebar();