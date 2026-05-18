let panelWindowId: number | null = null;

chrome.action.onClicked.addListener(async () => {
  // If window is already open, focus it instead of opening a new one
  if (panelWindowId !== null) {
    try {
      await chrome.windows.update(panelWindowId, { focused: true });
      return;
    } catch {
      // Window was closed externally
      panelWindowId = null;
    }
  }

  const win = await chrome.windows.create({
    url: chrome.runtime.getURL('panel.html'),
    type: 'popup',
    width: 420,
    height: 640,
    focused: true,
  });

  panelWindowId = win.id ?? null;

  if (panelWindowId !== null) {
    const id = panelWindowId;
    chrome.windows.onRemoved.addListener(function onRemoved(removedId) {
      if (removedId === id) {
        panelWindowId = null;
        chrome.windows.onRemoved.removeListener(onRemoved);
      }
    });
  }
});
