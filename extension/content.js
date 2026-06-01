(function() {
  'use strict';

  let mode = 'invisible';
  let enabled = true;

  try {
    mode = localStorage.getItem('netmate_mode') || 'invisible';
    enabled = localStorage.getItem('netmate_enabled') !== 'false';
  } catch (e) {}

  function deepHtmlSearch(doc, selector, unwrap = false, count = 1) {
    if (!doc) return null;
    if (count > 1) {
      const m = [...doc.querySelectorAll(selector)];
      if (m.length === count) return unwrap ? unwrapContent(m) : m;
    } else {
      const m = doc.querySelector(selector);
      if (m) return unwrap ? unwrapContent(m) : m;
    }
    const iframes = doc.querySelectorAll('iframe');
    for (const f of iframes) {
      try {
        const r = deepHtmlSearch(f.contentDocument, selector, unwrap, count);
        if (r) return r;
      } catch (e) {}
    }
    const shadows = [...doc.querySelectorAll('*')].filter(el => el.shadowRoot);
    for (const el of shadows) {
      if (count > 1) {
        const sm = [...el.shadowRoot.querySelectorAll(selector)];
        if (sm.length === count) return unwrap ? unwrapContent(sm) : sm;
      } else {
        const sm = el.shadowRoot.querySelector(selector);
        if (sm) return unwrap ? unwrapContent(sm) : sm;
      }
      const r = deepHtmlSearch(el.shadowRoot, selector, unwrap, count);
      if (r) return r;
    }
    return null;
  }

  function deepHtmlFindByTextContent(doc, text) {
    if (!doc) return null;
    text = text.trim();
    const d = [...doc.querySelectorAll('*')].find(el => el.textContent.trim() === text);
    if (d) return d;
    const iframes = doc.querySelectorAll('iframe');
    for (const f of iframes) {
      try {
        const r = deepHtmlFindByTextContent(f.contentDocument, text);
        if (r) return r;
      } catch (e) {}
    }
    const shadows = [...doc.querySelectorAll('*')].filter(el => el.shadowRoot);
    for (const el of shadows) {
      const t = [...el.shadowRoot.querySelectorAll('*')].find(el2 => el2.textContent.trim() === text);
      if (t) return t;
      const r = deepHtmlFindByTextContent(el.shadowRoot, text);
      if (r) return r;
    }
    return null;
  }

  function unwrapContent(el) {
    if (Array.isArray(el)) return el.map(unwrapContent);
    if (el.contentDocument) return el.contentDocument;
    if (el.shadowRoot) return el.shadowRoot;
    return el;
  }

  const selStyle = document.createElement('style');
  selStyle.textContent = '* { user-select: text !important; -webkit-user-select: text !important; }';
  document.head.appendChild(selStyle);

  function enableTextSelectionRecursive(doc) {
    if (!doc) return;
    doc = doc || document;
    const stop = (e) => { e.stopPropagation(); };
    ['selectstart', 'copy', 'cut', 'paste']
      .forEach(ev => doc.addEventListener(ev, stop, true));
    const iframes = doc.querySelectorAll('iframe');
    for (const f of iframes) {
      try { if (f.contentDocument) enableTextSelectionRecursive(f.contentDocument); } catch (e) {}
    }
    const shadows = [...doc.querySelectorAll('*')].filter(el => el.shadowRoot);
    for (const el of shadows) {
      try { enableTextSelectionRecursive(el.shadowRoot); } catch (e) {}
    }
  }

  const components = [];
  let questions = [];
  const componentUrls = [];

  const processedQE = new WeakSet();
  const processedLabels = new WeakSet();
  const processedMatchPairs = new WeakSet();
  const processedDropdown = new WeakSet();
  const processedYesNo = new WeakSet();
  const processedOpenText = new WeakSet();
  const processedFillDivs = new WeakSet();
  const processedFillOpts = new WeakSet();
  const processedRows = new WeakSet();
  const processedTblOpts = new WeakSet();
  const processedOpenBtns = new WeakSet();

  let isRunning = false;

  function stripTags(s) {
    return s ? s.replace(/<[^>]*>/g, '').trim() : '';
  }

  function fetchComponents(url) {
    return fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json) return;
        const arr = Array.isArray(json) ? json : [json];
        arr.filter(c => c._items)
          .filter(c => !components.some(x => x._id === c._id))
          .forEach(c => {
            const tmp = document.createElement('div');
            tmp.innerHTML = c.body || '';
            c.body = tmp.textContent.trim();
            components.push(c);
          });
      })
      .catch(() => {});
  }

  function findAllInputsBasic(doc, id, count) {
    const inputs = [];
    for (let i = 0; i < count; i++) {
      const inp = deepHtmlSearch(doc, `#${CSS.escape(id)}-${i}-input`);
      const lbl = deepHtmlSearch(doc, `#${CSS.escape(id)}-${i}-label`);
      if (inp) inputs.push({ input: inp, label: lbl });
      if (inputs.length === count) break;
    }
    return inputs;
  }

  function findAllInputsMatch(doc, count) {
    const btns = [];
    for (let i = 0; i < count; i++) {
      const pair = deepHtmlSearch(doc, `[data-id="${i}"]`, false, 2);
      if (pair) btns.push(pair);
      if (btns.length === count) break;
    }
    return btns;
  }

  function setDropdownQuestions(question) {
    question.items.forEach((item, i) => {
      const qDiv = deepHtmlSearch(question.questionDiv, `[index="${i}"]`, true);
      if (!qDiv) return;
      const qEl = deepHtmlFindByTextContent(qDiv, item.text ? item.text.trim() : '');
      for (const [idx, opt] of (item._options || []).entries()) {
        if (opt._isCorrect) {
          const optEl = deepHtmlSearch(qDiv, `#dropdown__item-index-${idx}`, true);
          if (optEl) {
            questions.push({
              questionDiv: qDiv, questionElement: qEl,
              inputs: [optEl], questionType: 'dropdownSelect'
            });
          }
          return;
        }
      }
    });
  }

  function initYesNo(question) {
    if (processedYesNo.has(question.questionDiv)) return;
    processedYesNo.add(question.questionDiv);
    const qEl = deepHtmlSearch(question.questionDiv, '.img_question');
    if (!qEl) return;
    qEl.parentElement?.addEventListener('click', () => {
      for (const item of question.items) {
        if (qEl.alt === item._graphic?.alt) {
          const btn = deepHtmlSearch(question.questionDiv,
            item._shouldBeSelected ? '.user_selects_yes' : '.user_selects_no');
          btn?.click();
        }
      }
    });
    const yesBtn = deepHtmlSearch(question.questionDiv, '.user_selects_yes');
    const noBtn = deepHtmlSearch(question.questionDiv, '.user_selects_no');
    yesBtn?.addEventListener('mouseover', e => {
      if (e.ctrlKey) {
        const imgEl = deepHtmlSearch(question.questionDiv, '.img_question');
        if (imgEl) {
          const item = question.items.find(x => x._graphic?.alt === imgEl.alt);
          if (item && item._shouldBeSelected) yesBtn.click();
        }
      }
    });
    noBtn?.addEventListener('mouseover', e => {
      if (e.ctrlKey) {
        const imgEl = deepHtmlSearch(question.questionDiv, '.img_question');
        if (imgEl) {
          const item = question.items.find(x => x._graphic?.alt === imgEl.alt);
          if (item && !item._shouldBeSelected) noBtn.click();
        }
      }
    });
  }

  function initOpenText(question) {
    question.items.forEach((item, i) => {
      const qEl = deepHtmlSearch(question.questionDiv, `#${CSS.escape(`${question.id}-option-${i}`)}`);
      const btn = deepHtmlSearch(question.questionDiv, `.current-item-${i}`, true);
      if (qEl && !processedOpenText.has(qEl)) {
        processedOpenText.add(qEl);
        qEl.addEventListener('click', () => {
          setTimeout(() => {
            btn?.click();
            const cur = qEl.textContent ? qEl.textContent.trim() : '';
            const found = question.items.find(x => x._options && x._options.text && x._options.text.trim() === cur);
            if (found && found.position && found.position[0]) {
              setTimeout(() => {
                const inp = deepHtmlSearch(question.questionDiv, `[data-target="${found.position[0]}"]`);
                inp?.click();
              }, 100);
            }
          }, 100);
        });
      }
      if (btn && !processedOpenBtns.has(btn)) {
        processedOpenBtns.add(btn);
        btn.addEventListener('click', () => {
          setTimeout(() => {
            const cur = qEl ? qEl.textContent.trim() : '';
            const found = question.items.find(x => x._options && x._options.text && x._options.text.trim() === cur);
            if (found && found.position && found.position[0]) {
              setTimeout(() => {
                const inp = deepHtmlSearch(question.questionDiv, `[data-target="${found.position[0]}"]`);
                if (inp && !inp.dataset.nmHover) {
                  inp.dataset.nmHover = '1';
                  inp.addEventListener('mouseover', ev => {
                    if (ev.ctrlKey) inp.click();
                  });
                }
              }, 100);
            }
          }, 100);
        });
      }
    });
  }

  function initFillBlanks(question) {
    const divs = [...deepHtmlSearch(question.questionDiv, '.fillblanks__item', true, question.answersLength)];
    if (!divs) return;
    divs.forEach(div => {
      if (processedFillDivs.has(div)) return;
      processedFillDivs.add(div);
      const text = div.textContent.trim();
      for (const item of question.items) {
        const pre = stripTags(item.preText);
        const post = stripTags(item.postText);
        if (text.startsWith(pre) && text.endsWith(post)) {
          const correct = (item._options || []).find(o => o._isCorrect);
          if (!correct) break;
          const opts = [...deepHtmlSearch(div, '.dropdown__item', true, item._options.length)];
          if (!opts) break;
          for (const opt of opts) {
            if (processedFillOpts.has(opt)) break;
            processedFillOpts.add(opt);
            if (opt.textContent.trim() === correct.text.trim()) {
              div.addEventListener('click', () => {
                if (enabled) opt.click();
              });
              opt.addEventListener('mouseover', ev => {
                if (ev.ctrlKey && enabled) opt.click();
              });
              break;
            }
          }
          break;
        }
      }
    });
  }

  function initTableDropdown(question) {
    const rows = [...deepHtmlSearch(question.questionDiv, 'tbody tr', true, question.answersLength)];
    if (!rows) return;
    rows.forEach((row, i) => {
      if (processedRows.has(row)) return;
      processedRows.add(row);
      const opts = [...deepHtmlSearch(row, '[role="option"]', true, question.items[i] && question.items[i]._options ? question.items[i]._options.length : 0)];
      const correct = (question.items[i] ? question.items[i]._options || [] : []).find(o => o._isCorrect);
      if (!correct) return;
      for (const opt of opts) {
        if (processedTblOpts.has(opt)) break;
        processedTblOpts.add(opt);
        if (opt.textContent.trim() === correct.text.trim()) {
          row.addEventListener('click', () => {
            if (enabled) opt.click();
          });
          opt.addEventListener('mouseover', ev => {
            if (ev.ctrlKey && enabled) opt.click();
          });
          break;
        }
      }
    });
  }

  function findQuestionEl(doc) {
    for (const c of components) {
      const el = deepHtmlFindByTextContent(doc, c.body);
      if (el) return el;
    }
    return null;
  }

  async function buildQuestions() {
    questions = [];
    for (const c of components) {
      const qDiv = deepHtmlSearch(document, `.${CSS.escape(c._id)}`);
      if (!qDiv) continue;
      let qType = 'basic';
      const first = c._items[0];
      if (first && first.text && first._options) qType = 'dropdownSelect';
      else if (first && first.question && first.answer) qType = 'match';
      else if (first && first._graphic && first._graphic.alt && first._graphic.src) qType = 'yesNo';
      else if (first && first.id && first._options && first._options.text) qType = 'openTextInput';
      else if (first && first.preText && first.postText && first._options && first._options[0] && first._options[0].text) qType = 'fillBlanks';
      else if (first && first._options && first._options[0] && first._options[0].text && typeof first._options[0]._isCorrect === 'boolean') qType = 'tableDropdown';
      questions.push({
        questionDiv: qDiv, id: c._id,
        answersLength: c._items.length,
        questionType: qType, items: c._items
      });
    }
  }

  function setupQuestionElements() {
    questions.forEach(q => {
      if (q.questionType === 'basic') {
        q.questionElement = findQuestionEl(q.questionDiv);
        q.inputs = findAllInputsBasic(q.questionDiv, q.id, q.answersLength) || [];
      } else if (q.questionType === 'match') {
        q.questionElement = findQuestionEl(q.questionDiv);
        q.inputs = findAllInputsMatch(q.questionDiv, q.answersLength) || [];
      } else if (q.questionType === 'dropdownSelect') {
        setDropdownQuestions(q);
        q.skip = true;
      } else if (q.questionType === 'yesNo') {
        initYesNo(q);
        q.skip = true;
      } else if (q.questionType === 'openTextInput') {
        initOpenText(q);
        q.skip = true;
      } else if (q.questionType === 'fillBlanks') {
        initFillBlanks(q);
        q.skip = true;
      } else if (q.questionType === 'tableDropdown') {
        initTableDropdown(q);
        q.skip = true;
      }
    });
  }

  function initClickListeners() {
    questions.forEach(q => {
      if (q.skip || !q.questionElement) return;
      if (processedQE.has(q.questionElement)) return;
      processedQE.add(q.questionElement);
      q.questionElement.addEventListener('click', () => {
        if (!enabled) return;
        const comp = components.find(c => c._id === q.id);
        if (!comp) return;
        if (q.questionType === 'basic') {
          q.inputs.forEach(({ input, label }, i) => {
            if (input.checked && label) label.click();
            if (comp._items[i] && comp._items[i]._shouldBeSelected && label) {
              setTimeout(() => label.click(), 10);
            }
          });
        } else if (q.questionType === 'match') {
          q.inputs.forEach(pair => {
            if (pair[0]) pair[0].click();
            if (pair[1]) pair[1].click();
          });
        }
      });
    });
  }

  function initHoverListeners() {
    questions.forEach(q => {
      if (q.skip) return;
      const comp = components.find(c => c._id === q.id);
      if (!comp) return;
      if (q.questionType === 'basic') {
        q.inputs.forEach(({ input, label }, i) => {
          if (!label || processedLabels.has(label)) return;
          processedLabels.add(label);
          label.addEventListener('mouseover', e => {
            if (!e.ctrlKey || !enabled) return;
            if (input.checked) label.click();
            if (comp._items[i] && comp._items[i]._shouldBeSelected) {
              setTimeout(() => label.click(), 10);
            }
          });
        });
      } else if (q.questionType === 'match') {
        q.inputs.forEach(pair => {
          if (!pair[0] || processedMatchPairs.has(pair[0])) return;
          processedMatchPairs.add(pair[0]);
          pair[0].addEventListener('mouseover', e => {
            if (!e.ctrlKey || !enabled) return;
            pair[0].click();
            pair[1].click();
          });
        });
      }
    });
  }

  function isReady() {
    return components.some(c => deepHtmlSearch(document, `.${CSS.escape(c._id)}`));
  }

  async function main() {
    await buildQuestions();
    setupQuestionElements();
    initClickListeners();
    initHoverListeners();
    enableTextSelectionRecursive();
  }

  function tryMain() {
    if (isRunning) return;
    isRunning = true;
    const check = () => {
      if (isReady()) {
        clearInterval(interval);
        main().finally(() => { isRunning = false; });
      }
    };
    const interval = setInterval(check, 1000);
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'COMPONENTS_URL' && request.url && !componentUrls.includes(request.url)) {
      componentUrls.push(request.url);
      fetchComponents(request.url).then(() => tryMain());
    }
    if (request.type === 'SET_MODE') {
      mode = request.mode;
      try { localStorage.setItem('netmate_mode', mode); } catch (e) {}
    }
    if (request.type === 'TOGGLE') {
      enabled = request.enabled;
      try { localStorage.setItem('netmate_enabled', enabled); } catch (e) {}
    }
  });

  setInterval(() => {
    if (isRunning || components.length === 0) return;
    let visible = 0;
    for (const c of components) {
      if (deepHtmlSearch(document, `.${CSS.escape(c._id)}`)) visible++;
    }
    if (visible !== questions.length) tryMain();
  }, 1000);
})();
