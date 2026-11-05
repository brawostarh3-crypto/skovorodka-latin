'use strict';

const groups = { vowel: 'Гласная разновидность', b: 'Смешанная группа Б', a: 'Смешанная группа А', consonant: 'Согласная разновидность' };
const genders = { m: 'мужской', f: 'женский', n: 'средний' };
const { entries, topics, sources } = window.LatinLexicon;

const $ = id => document.getElementById(id);
const clean = value => value.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const latinWord = /^[a-z]+$/;
const caseLabels = {
  nom: { short: 'Nom. sg.', full: 'Именительный падеж единственного числа' },
  gen: { short: 'Gen. sg.', full: 'Родительный падеж единственного числа' },
  plural: { short: 'Gen. pl.', full: 'Родительный падеж множественного числа' }
};

function wordForms([nom, gen, , , , meta]) {
  return { nom, gen, plural: meta?.genPlural };
}

const formIndex = new Map();
for (const entry of entries) {
  for (const form of new Set(Object.values(wordForms(entry)).filter(Boolean))) {
    const matches = formIndex.get(form) || [];
    matches.push(entry);
    formIndex.set(form, matches);
  }
}

function syllables(word) {
  // Count vowel nuclei in common Latin spellings. Greek loans may need dictionary confirmation.
  const vowels = word.replace(/qu/g, 'q').match(/ae|oe|au|eu|[aeiouy]/g);
  return vowels ? vowels.length : 0;
}

function classify(nom, gen, gender) {
  const stem = gen.slice(0, -2);
  const nomCount = syllables(nom);
  const genCount = syllables(gen);
  const equal = nomCount === genCount;
  const end = (stem.match(/[^aeiouy]+$/) || [''])[0];
  const vowelType = gender === 'n' && /(?:e|al|ar)$/.test(nom);
  const groupB = equal && gender !== 'n' && /(?:is|es)$/.test(nom);
  let group = '';
  if (vowelType) group = 'vowel';
  else if (groupB) group = 'b';
  else if (!equal && end.length >= 2) group = 'a';
  else if (!equal && end.length === 1) group = 'consonant';
  return { stem, nomCount, genCount, equal, end, vowelType, groupB, group };
}

function node(tag, content, className) {
  const element = document.createElement(tag);
  element.textContent = content;
  if (className) element.className = className;
  return element;
}

function showResult([nom, gen, gender, translation, known, meta], query = nom) {
  const detail = classify(nom, gen, gender);
  const group = known || detail.group;
  const result = node('div', '', 'feedback word-result');
  const heading = node('p', '', 'result-form');
  const forms = node('span', nom + ', ' + gen);
  forms.lang = 'la';
  heading.append(forms, translation ? ' · ' + translation : ' · ' + genders[gender] + ' род');
  result.append(heading, node('h3', group ? groups[group] : 'По этой схеме тип не определён'));
  if (query !== nom) {
    const form = Object.entries(wordForms([nom, gen, gender, translation, known, meta]))
      .find(([, value]) => value === query)?.[0];
    if (form) {
      const match = node('p', '', 'result-match');
      const typed = node('i', query);
      typed.lang = 'la';
      match.append(typed, ' — ' + caseLabels[form].full.toLowerCase() + '.');
      result.append(match);
    }
  }

  const evidence = node('dl', '', 'result-evidence');
  for (const [label, value, latin] of [
    ['Практическая основа', detail.stem + '−', true],
    ['Слогов в двух формах', detail.nomCount + ' / ' + detail.genCount, false],
    ['Конец основы', detail.end || 'гласная', Boolean(detail.end)]
  ]) {
    const item = node('div', '');
    const answer = node('dd', value);
    if (latin) answer.lang = 'la';
    item.append(node('dt', label), answer);
    evidence.append(item);
  }
  result.append(evidence);
  if (group) {
    const reason = known && known !== detail.group
      ? meta?.note || 'Для этого слова указан словарный тип. По общим признакам оно может выглядеть как слово другой группы.'
      : explainAnswer([nom, gen, gender, translation, group]);
    result.append(node('p', reason, 'result-note'));
  }
  if (!known) {
    result.append(node('p', 'Слоги посчитаны по написанию. Сверь род и формы родительного падежа со словарём.', 'result-note muted'));
  }
  $('result').replaceChildren(result);
}

function analyze() {
  const nom = clean($('noun').value);
  const gen = clean($('genitive').value);
  const gender = $('gender').value;
  const matches = formIndex.get(nom) || [];
  if (!latinWord.test(nom)) {
    $('result').replaceChildren(node('p', 'Введи одно латинское слово буквами A–Z.', 'feedback error'));
    return;
  }
  if (matches.length === 1 && !gen) {
    showResult(matches[0], nom);
    playCue('lookup');
    return;
  }
  if (matches.length > 1 && !gen) {
    const choices = node('div', '', 'feedback');
    choices.append(node('p', 'У этой формы несколько значений. Выбери нужное.'));
    const row = node('div', '', 'row');
    for (const entry of matches) {
      const button = node('button', entry[0] + ', ' + entry[1] + ' · ' + entry[3], 'secondary');
      button.addEventListener('click', () => {
        showResult(entry, nom);
        playCue('lookup');
      });
      row.append(button);
    }
    choices.append(row);
    $('result').replaceChildren(choices);
    return;
  }
  $('extra').hidden = false;
  if (!gen || !gender || !latinWord.test(gen) || !gen.endsWith('is') || gen.length < 4 || !syllables(nom)) {
    $('result').replaceChildren(node('p', 'Укажи род и введи полную форму Gen. sg. на −is. Например, corporis.', 'feedback error'));
    if (!gen) $('genitive').focus();
    return;
  }
  showResult(matches.find(entry => entry[0] === nom && entry[1] === gen && entry[2] === gender) || [nom, gen, gender]);
  playCue('lookup');
}

$('analyze').addEventListener('submit', event => {
  event.preventDefault();
  analyze();
});

$('noun').addEventListener('input', () => {
  $('extra').hidden = true;
  $('genitive').value = '';
  $('gender').value = '';
  $('result').replaceChildren();
});

function choose(word, entry) {
  $('noun').value = word;
  $('noun').dispatchEvent(new Event('input'));
  if (entry) {
    showResult(entry, word);
    playCue('lookup');
    return;
  }
  analyze();
}

const AudioEngine = window.AudioContext || window.webkitAudioContext;
const cues = {
  select: { start: 485, end: 525, duration: .105, level: .031 },
  form: { start: 630, end: 580, duration: .085, level: .025, type: 'triangle' },
  split: { start: 505, end: 345, duration: .145, level: .033 },
  join: { start: 340, end: 505, duration: .125, level: .029 },
  lookup: { start: 365, end: 415, duration: .105, level: .031 },
  turn: { start: 370, end: 470, duration: .115, level: .029, type: 'triangle' },
  correct: { start: 440, end: 590, duration: .17, level: .045 },
  retry: { start: 345, end: 278, duration: .16, level: .038 },
  finish: { start: 380, end: 650, duration: .24, level: .038 }
};
let audioEngine;
let cueRequest = 0;
let activeCue;

async function playCue(kind) {
  if (!AudioEngine) return;
  const request = ++cueRequest;
  try {
    if (!audioEngine || audioEngine.state === 'closed') audioEngine = new AudioEngine();
    if (audioEngine.state !== 'running') await audioEngine.resume();
  } catch {
    return;
  }
  if (request !== cueRequest || audioEngine.state !== 'running') return;

  const now = audioEngine.currentTime;
  const previous = activeCue;
  const start = previous ? now + .012 : now;
  if (previous) {
    const gain = previous.envelope.gain;
    if (typeof gain.cancelAndHoldAtTime === 'function') {
      gain.cancelAndHoldAtTime(now);
      gain.linearRampToValueAtTime(0, start);
    } else {
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(0, now, .003);
    }
    previous.note.stop(start);
  }

  const { start: pitch, end, duration, level, type = 'sine' } = cues[kind];
  const note = audioEngine.createOscillator();
  const envelope = audioEngine.createGain();
  const cue = { note, envelope };
  activeCue = cue;
  note.type = type;
  note.frequency.setValueAtTime(pitch, start);
  note.frequency.exponentialRampToValueAtTime(end, start + duration * .65);
  envelope.gain.setValueAtTime(.0001, start);
  envelope.gain.exponentialRampToValueAtTime(level, start + .018);
  envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
  note.connect(envelope).connect(audioEngine.destination);
  note.start(start);
  note.stop(start + duration + .01);
  note.onended = () => {
    note.disconnect();
    envelope.disconnect();
    if (activeCue === cue) activeCue = undefined;
  };
}

const specimens = [
  ['dens', 'tooth'], ['canalis', 'canal'], ['corpus', 'body'], ['capillare', 'capillary']
].map(([word, drawing]) => ({ entry: entries.find(entry => entry[0] === word), drawing }));
let specimenIndex = 0;
let specimenForm = 'gen';
let endingAnimation;

const formButtons = Object.entries(caseLabels).map(([form, label]) => {
  const button = node('button', label.short, 'form-choice');
  button.type = 'button';
  button.setAttribute('aria-label', label.short + ' ' + label.full);
  button.addEventListener('click', () => {
    if (specimenForm === form) return;
    specimenForm = form;
    renderSpecimenForm();
    playCue('form');
  });
  return [form, button];
});
$('form-picker').append(...formButtons.map(([, button]) => button));

function renderSpecimenForm() {
  endingAnimation?.stop();
  endingAnimation = undefined;
  const entry = specimens[specimenIndex].entry;
  const forms = wordForms(entry);
  if (!forms[specimenForm]) specimenForm = 'gen';
  for (const [key, button] of formButtons) {
    button.disabled = !forms[key];
    button.setAttribute('aria-pressed', String(key === specimenForm));
    button.title = forms[key] ? caseLabels[key].full : 'Форма не указана в словаре';
  }

  $('form-help').textContent = forms.plural
    ? 'Выбери форму, чтобы сравнить её с остальными.'
    : 'Gen. pl. для этого слова в базе пока не указан.';
  const slot = $('specimen-form-slot');
  const form = node('p', '', 'specimen-form');
  form.lang = 'la';
  if (specimenForm === 'gen') {
    form.append(node('span', forms.gen.slice(0, -2), 'specimen-stem'), node('span', 'is', 'specimen-ending'));
  } else {
    form.textContent = forms[specimenForm];
  }
  slot.replaceChildren(node('p', caseLabels[specimenForm].full, 'specimen-label'), form);
  const translation = $('specimen-word').querySelector('.specimen-translation');
  translation.textContent = entry[3];
  const split = $('specimen-split');
  split.disabled = specimenForm !== 'gen';
  split.setAttribute('aria-pressed', 'false');
  split.textContent = 'Показать основу';
  slot.closest('.specimen-plate').classList.remove('is-split');
}

function renderSpecimen() {
  const { entry: [, , , , group], drawing } = specimens[specimenIndex];
  const plate = node('div', '', 'specimen-plate');
  const slot = node('div', '');
  slot.id = 'specimen-form-slot';
  const art = node('img', '', 'specimen-drawing');
  art.src = 'assets/' + drawing + '.svg';
  art.alt = '';
  art.width = 220;
  art.height = 145;
  const notes = node('div', '', 'specimen-notes');
  notes.append(node('p', '', 'specimen-translation'), node('p', groups[group], 'specimen-group'));
  plate.append(art, slot, notes);
  $('specimen-word').replaceChildren(plate);
  $('specimen-index').textContent = (specimenIndex + 1) + ' / ' + specimens.length;
  specimenButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === specimenIndex)));
  renderSpecimenForm();
}

$('specimen-split').addEventListener('click', event => {
  const toggle = event.currentTarget;
  const plate = document.querySelector('.specimen-plate');
  const ending = plate.querySelector('.specimen-ending');
  const [, gen, , translation] = specimens[specimenIndex].entry;
  const split = toggle.getAttribute('aria-pressed') === 'false';
  toggle.setAttribute('aria-pressed', String(split));
  toggle.textContent = split ? 'Вернуть окончание' : 'Показать основу';
  plate.classList.toggle('is-split', split);
  plate.querySelector('.specimen-translation').textContent = split
    ? 'Практическая основа ' + gen.slice(0, -2) + '−'
    : translation;
  endingAnimation?.stop();
  const motion = window.AtlasMotion;
  if (motion && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    endingAnimation = motion.animate(ending, { transform: split ? 'translateX(14px)' : 'translateX(0)' }, {
      duration: .24,
      ease: [.22, .75, .25, 1]
    });
  } else {
    ending.style.transform = split ? 'translateX(14px)' : '';
  }
  playCue(split ? 'split' : 'join');
});

const specimenButtons = specimens.map(({ entry }, index) => {
  const button = node('button', entry[0], 'specimen-choice');
  button.type = 'button';
  button.lang = 'la';
  button.addEventListener('click', () => {
    if (index === specimenIndex) return;
    specimenIndex = index;
    renderSpecimen();
    playCue('select');
  });
  return button;
});
$('specimen-picker').append(...specimenButtons);

function openAnalysis(event, word, entry) {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  choose(word, entry);
  $('analysis').scrollIntoView();
  $('noun').focus({ preventScroll: true });
}

$('specimen-open').addEventListener('click', event => {
  const entry = specimens[specimenIndex].entry;
  openAnalysis(event, wordForms(entry)[specimenForm], entry);
});
for (const example of document.querySelectorAll('.rule-example')) {
  example.addEventListener('click', event => openAnalysis(event, example.dataset.word));
}
renderSpecimen();

const exampleGroups = Object.entries({ b: 'canalis', consonant: 'corpus', a: 'os', vowel: 'mare' })
  .map(([group, first]) =>
    [...new Set([first, ...entries.filter(entry => entry[4] === group).map(entry => entry[0])])]
  );
let exampleRound = 0;

function renderExamples() {
  const buttons = exampleGroups.map(words => {
    const word = words[exampleRound % words.length];
    const button = node('button', word, 'secondary example');
    button.lang = 'la';
    button.addEventListener('click', () => choose(word));
    return button;
  });
  $('examples').replaceChildren(...buttons);
}

$('refresh-examples').addEventListener('click', () => {
  exampleRound++;
  renderExamples();
});
renderExamples();

function shuffled(items) {
  const order = [...items];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

let deck;
let current;
let answered;
let correct;
let mistakes;
let practiceMode = 'group';
let practiceTopic = '';

function startRound(words) {
  if (words) {
    deck = words;
  } else {
    const pool = shuffled(entries.filter(entry => !practiceTopic || entry[5].topic === practiceTopic));
    const balanced = Object.keys(groups).flatMap(group => pool.filter(entry => entry[4] === group).slice(0, 2));
    const selected = new Set(balanced);
    deck = shuffled([...balanced, ...pool.filter(entry => !selected.has(entry))].slice(0, 8));
  }
  $('quiz-topic').hidden = !practiceTopic;
  $('quiz-topic').textContent = practiceTopic ? topics[practiceTopic] : '';
  $('all-practice-topics').hidden = !practiceTopic;
  current = 0;
  answered = 0;
  correct = 0;
  mistakes = [];
  $('quiz-summary').hidden = true;
  $('quiz-task').hidden = false;
  $('next').hidden = false;
  question();
}

function updateScore() {
  $('score').textContent = 'Верно ' + correct + ' из ' + answered;
  document.querySelector('.quiz-meter span').style.transform = 'scaleX(' + answered / deck.length + ')';
}

function explainAnswer(entry) {
  const [nom, gen, gender, , group] = entry;
  const detail = classify(nom, gen, gender);
  if (detail.group !== group) return entry[5]?.note || 'Для этого слова запомни словарный тип.';
  switch (group) {
    case 'vowel': return 'Средний род и характерное окончание именительного падежа.';
    case 'b': return 'Формы равносложны, именительный падеж оканчивается на −is или −es.';
    default: return 'На конце основы ' + (group === 'a' ? 'несколько согласных' : 'одна согласная') + '.';
  }
}

function checkAnswer(isCorrect, selectedButton) {
  if (!$('next').disabled) return;
  const entry = deck[current];
  const [, gen, , , group] = entry;
  answered++;
  if (isCorrect) correct++;
  else mistakes.push(entry);
  playCue(isCorrect ? 'correct' : 'retry');
  updateScore();

  if (practiceMode === 'group') {
    for (const choice of $('options').children) {
      choice.disabled = true;
      if (choice.dataset.group === group) choice.classList.add('correct');
    }
    if (!isCorrect) selectedButton.classList.add('wrong');
    $('feedback').textContent = (isCorrect ? 'Верно. ' : 'Правильный ответ — ') +
      groups[group].toLowerCase() + '. ' + explainAnswer(entry) + ' Основа ' + gen.slice(0, -2) + '−.';
  } else {
    $('stem-input').readOnly = true;
    $('stem-answer').querySelector('button').disabled = true;
    $('feedback').textContent = (isCorrect ? 'Верно. ' : '') + 'Основа ' + gen.slice(0, -2) +
      '−. В форме ' + gen + ' убираем окончание −is.';
  }
  $('feedback').classList.toggle('error', !isCorrect);
  $('next').disabled = false;
  $('next').focus();
}

function question() {
  const [nom, gen, gender, translation, group] = deck[current];
  const isStem = practiceMode === 'stem';
  const word = node('span', nom + ', ' + gen + ' ' + gender, 'quiz-word');
  $('question').replaceChildren(word);
  $('quiz-instruction').textContent = isStem
    ? 'Как выглядит практическая основа?'
    : 'К какому типу относится слово?';
  $('quiz-translation').textContent = translation;
  $('quiz-step').textContent = 'Слово ' + (current + 1) + ' из ' + deck.length;
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  $('next').textContent = current + 1 === deck.length ? 'Итоги раунда' : 'Следующее слово';
  $('next').disabled = true;
  $('options').replaceChildren();
  $('options').hidden = isStem;
  $('stem-answer').hidden = !isStem;
  updateScore();
  if (isStem) {
    $('stem-input').value = '';
    $('stem-input').readOnly = false;
    $('stem-answer').querySelector('button').disabled = false;
    return;
  }
  for (const [id, title] of Object.entries(groups)) {
    const button = node('button', title, 'option');
    button.dataset.group = id;
    button.addEventListener('click', () => checkAnswer(id === group, button));
    $('options').append(button);
  }
}

$('stem-answer').addEventListener('submit', event => {
  event.preventDefault();
  if (practiceMode !== 'stem' || !$('next').disabled) return;
  const answer = clean($('stem-input').value).replace(/[-−–]$/, '').trim();
  if (!latinWord.test(answer)) {
    $('feedback').classList.add('error');
    $('feedback').textContent = 'Впиши основу латинскими буквами.';
    return;
  }
  checkAnswer(answer === deck[current][1].slice(0, -2));
});

for (const mode of ['group', 'stem']) {
  $('mode-' + mode).addEventListener('click', () => {
    if (practiceMode === mode) return;
    practiceMode = mode;
    $('mode-group').setAttribute('aria-pressed', String(mode === 'group'));
    $('mode-stem').setAttribute('aria-pressed', String(mode === 'stem'));
    startRound();
    $('question').focus();
  });
}

$('all-practice-topics').addEventListener('click', () => {
  practiceTopic = '';
  startRound();
  $('question').focus();
});

function finishRound() {
  $('quiz-step').textContent = 'Раунд завершён';
  $('quiz-task').hidden = true;
  $('next').hidden = true;
  $('options').replaceChildren();
  $('feedback').textContent = '';
  const summary = $('quiz-summary');
  const title = node('h3', mistakes.length ? 'Что повторить' : 'Все слова разобраны верно');
  title.tabIndex = -1;
  summary.replaceChildren(title);
  if (mistakes.length) {
    const list = node('ul', '', 'review-list');
    for (const [nom, gen, , translation, group] of mistakes) {
      const item = node('li', '');
      const form = node('strong', nom + ', ' + gen);
      form.lang = 'la';
      const answer = practiceMode === 'stem' ? 'основа ' + gen.slice(0, -2) + '−' : groups[group];
      item.append(form, node('span', translation + ' · ' + answer));
      list.append(item);
    }
    summary.append(list);
  }
  const actions = node('div', '', 'row');
  const newRound = node('button', 'Новый раунд', mistakes.length ? 'secondary' : '');
  newRound.addEventListener('click', () => {
    startRound();
    $('question').focus();
  });
  if (mistakes.length) {
    const retry = node('button', 'Повторить ошибки');
    retry.addEventListener('click', () => {
      startRound([...mistakes]);
      $('question').focus();
    });
    actions.append(retry);
  }
  actions.append(newRound);
  summary.append(actions);
  summary.hidden = false;
  title.focus();
}

$('next').addEventListener('click', () => {
  if (current + 1 === deck.length) {
    finishRound();
    playCue('finish');
    return;
  }
  current++;
  playCue('turn');
  question();
  $('question').focus();
});

const dictionaryOrder = [...entries].sort((a, b) => a[0].localeCompare(b[0], 'la') || a[1].localeCompare(b[1], 'la'));
const pageSize = 12;
let dictionaryPage = 0;
let dictionarySelection;
let entryAnimation;

function showDictionaryEntry(entry, moveFocus = false) {
  const [nom, gen, gender, translation, group, meta] = entry;
  const panel = $('dictionary-entry');
  const title = node('h3', nom, 'entry-title');
  title.lang = 'la';
  const fields = node('dl', '', 'entry-fields');
  for (const [label, value, isLatin] of [
    ['Gen. sg.', gen, true],
    ['Основа', meta.stem + '−', true],
    ['Род', genders[gender], false],
    ['Gen. pl.', meta.genPlural, true]
  ]) {
    if (!value) continue;
    const pair = node('div', '');
    const definition = node('dd', value);
    if (isLatin) definition.lang = 'la';
    if (label === 'Gen. sg.') {
      definition.replaceChildren(document.createTextNode(meta.stem), node('mark', 'is', 'entry-ending'));
    }
    pair.append(node('dt', label), definition);
    fields.append(pair);
  }
  const body = node('div', '', 'entry-body');
  body.append(node('p', topics[meta.topic], 'entry-topic'), title, node('p', translation, 'entry-translation'),
    fields, node('p', groups[group], 'entry-group'));
  if (meta.note) body.append(node('p', meta.note, 'entry-note'));
  if (meta.source) {
    const source = sources[meta.source];
    const attribution = node('p', '', 'entry-attribution');
    const link = node('a', source.title);
    link.href = source.url;
    attribution.append(link, '. ' + source.publication + (meta.locator ? '. ' + meta.locator + '.' : '.'));
    body.append(attribution);
  }
  const analyzeLink = node('a', 'Открыть разбор', 'button');
  analyzeLink.href = '#analysis';
  analyzeLink.addEventListener('click', event => {
    openAnalysis(event, nom, entry);
  });
  const returnButton = node('button', 'К списку', 'text-button');
  returnButton.type = 'button';
  returnButton.addEventListener('click', () => $('words').querySelector('[aria-pressed="true"]')?.focus());
  const actions = node('div', '', 'entry-actions');
  const practiceButton = node('button', 'Тренировать тему', 'secondary');
  practiceButton.type = 'button';
  practiceButton.addEventListener('click', () => {
    practiceTopic = meta.topic;
    startRound();
    $('practice').scrollIntoView();
    $('question').focus({ preventScroll: true });
  });
  actions.append(analyzeLink, practiceButton, returnButton);
  body.append(actions);
  entryAnimation?.stop();
  panel.replaceChildren(body);
  dictionarySelection = meta.id;
  for (const row of $('words').rows) {
    const selected = row.dataset.id === meta.id;
    row.classList.toggle('is-current', selected);
    row.querySelector('button').setAttribute('aria-pressed', String(selected));
  }
  if (moveFocus) {
    playCue('select');
    panel.focus();
    if (window.AtlasMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      entryAnimation = window.AtlasMotion.animate(body, { opacity: [.62, 1] }, {
        duration: .18, ease: [.22, .75, .25, 1]
      });
    }
  }
}

function renderWords() {
  const query = clean($('filter').value);
  const groupFilter = $('group-filter').value;
  const topicFilter = $('topic-filter').value;
  const matches = dictionaryOrder.filter(([nom, gen, , translation, group, meta]) =>
    (!groupFilter || groupFilter === group) && (!topicFilter || topicFilter === meta.topic) &&
    clean([nom, gen, meta.stem, meta.genPlural, translation, groups[group]].filter(Boolean).join(' ')).includes(query));
  const pages = Math.ceil(matches.length / pageSize);
  dictionaryPage = Math.min(dictionaryPage, Math.max(0, pages - 1));
  const visible = matches.slice(dictionaryPage * pageSize, (dictionaryPage + 1) * pageSize);
  $('count').textContent = matches.length
    ? 'Найдено словарных статей: ' + matches.length
    : 'По этому запросу ничего не найдено. Попробуй другую форму или сбрось фильтры.';
  $('dictionary-layout').hidden = visible.length === 0;
  $('clear-filters').hidden = visible.length > 0;
  $('dictionary-pages').hidden = pages < 2;
  $('dictionary-page').textContent = (dictionaryPage + 1) + ' / ' + pages;
  $('dictionary-prev').disabled = dictionaryPage === 0;
  $('dictionary-next').disabled = dictionaryPage + 1 >= pages;

  $('words').replaceChildren(...visible.map(entry => {
    const [nom, gen, , translation, group, meta] = entry;
    const row = node('tr', '');
    row.dataset.id = meta.id;
    const name = node('td', '');
    const button = node('button', '', 'entry-select');
    button.type = 'button';
    button.setAttribute('aria-controls', 'dictionary-entry');
    const form = node('span', nom, 'entry-nom');
    const companion = node('small', gen);
    form.lang = companion.lang = 'la';
    button.append(form, companion);
    button.addEventListener('click', () => showDictionaryEntry(entry, true));
    name.append(button);
    row.append(name, node('td', translation), node('td', groups[group], 'catalog-type'));
    return row;
  }));
  if (visible.length) {
    showDictionaryEntry(visible.find(entry => entry[5].id === dictionarySelection) || visible[0]);
  }
}

for (const [select, values] of [['group-filter', groups], ['topic-filter', topics]]) {
  for (const [id, label] of Object.entries(values)) {
    const option = node('option', label);
    option.value = id;
    $(select).append(option);
  }
  $(select).addEventListener('change', resetDictionaryPage);
}
function resetDictionaryPage() {
  dictionaryPage = 0;
  renderWords();
}
$('filter').addEventListener('input', resetDictionaryPage);
$('clear-filters').addEventListener('click', () => {
  $('filter').value = '';
  $('group-filter').value = '';
  $('topic-filter').value = '';
  resetDictionaryPage();
  $('filter').focus();
});
for (const [id, delta] of [['dictionary-prev', -1], ['dictionary-next', 1]]) {
  $(id).addEventListener('click', () => {
    dictionaryPage += delta;
    playCue('turn');
    renderWords();
    if ($(id).disabled) $(delta === 1 ? 'dictionary-prev' : 'dictionary-next').focus();
  });
}
renderWords();
startRound();







