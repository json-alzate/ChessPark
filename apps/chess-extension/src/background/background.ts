// Background service worker — minimal relay for auth state persistence
// Firebase Auth uses IndexedDB (persists across popup opens) so we mainly
// handle sign-out messages from the popup.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ alive: true });
  }
  return false;
});
