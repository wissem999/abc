document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['enabled', 'mode'], (data) => {
    if (data.enabled === false) setUIEnabled(false);
    if (data.mode) setUIMode(data.mode);
  });
});

function toggleEnabled() {
  const toggle = document.getElementById('toggle');
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const isOn = toggle.classList.toggle('on');
  setUIEnabled(isOn);
  chrome.storage.sync.set({ enabled: isOn });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE', enabled: isOn }).catch(() => {});
  });
}

function setUIEnabled(enabled) {
  const toggle = document.getElementById('toggle');
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (enabled) {
    toggle.classList.add('on');
    dot.classList.remove('off');
    text.textContent = 'Enabled';
  } else {
    toggle.classList.remove('on');
    dot.classList.add('off');
    text.textContent = 'Disabled';
  }
}

function setMode(mode, btn) {
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  chrome.storage.sync.set({ mode });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'SET_MODE', mode }).catch(() => {});
  });
}

function setUIMode(mode) {
  document.querySelectorAll('.mode-btn').forEach(b => {
    if (b.dataset.mode === mode) b.classList.add('active');
    else b.classList.remove('active');
  });
}
