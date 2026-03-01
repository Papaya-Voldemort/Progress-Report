const modes = ['View', 'Quick Update', 'Edit'];

const state = {
  mode: 'View',
  openId: 'ui-overhaul',
  title: 'Product Milestone Dashboard',
  tasks: [
    {
      id: 'ui-overhaul',
      name: 'UI Overhaul',
      progress: 80,
      notes: 'Refine the interaction system and visual polish.',
      items: [
        { id: 'hero', title: 'Rebuild Hero panel', done: true },
        { id: 'cards', title: 'Glass task cards', done: true },
        { id: 'motion', title: 'Micro-interactions pass', done: false },
        { id: 'accessibility', title: 'Keyboard nav and focus states', done: false }
      ]
    },
    {
      id: 'content-architecture',
      name: 'Content Architecture',
      progress: 58,
      notes: 'Break requirements into task streams and checkpoints.',
      items: [
        { id: 'stories', title: 'Map user journeys', done: true },
        { id: 'taxonomy', title: 'Task/subtask taxonomy', done: true },
        { id: 'state-map', title: 'State transition map', done: false },
        { id: 'qa', title: 'Content QA', done: false }
      ]
    },
    {
      id: 'launch-readiness',
      name: 'Launch Readiness',
      progress: 33,
      notes: 'Get the app production-ready once backend arrives.',
      items: [
        { id: 'build', title: 'Build and optimize bundles', done: true },
        { id: 'error', title: 'Error boundaries and states', done: false },
        { id: 'tracking', title: 'Telemetry hooks', done: false },
        { id: 'handoff', title: 'Backend integration checklist', done: false }
      ]
    }
  ]
};

const app = document.getElementById('app');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function animateCount(el, target, duration = 1200) {
  const start = performance.now();
  const from = Number(el.dataset.value || 0);

  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - (1 - progress) ** 3;
    const next = Math.round(from + (target - from) * eased);
    el.textContent = `${next}%`;
    el.dataset.value = String(next);

    if (progress < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

function calcOverallProgress() {
  if (!state.tasks || state.tasks.length === 0) return 0;
  const total = state.tasks.reduce((sum, task) => sum + task.progress, 0);
  return Math.round(total / state.tasks.length);
}

function render() {
  const overall = calcOverallProgress();

  app.innerHTML = `
    <header class="topbar">
      <div>
        ${
          state.mode === 'Edit'
            ? `<input id="titleInput" class="title-input" value="${escapeHtml(state.title)}" />`
            : `<h1>${escapeHtml(state.title)}</h1>`
        }
        <p>Animated project pulse with strict single-open task drilldown.</p>
      </div>
      <div class="mode-toggle" role="group" aria-label="Display mode">
        ${modes
          .map(
            (mode) =>
              `<button type="button" aria-pressed="${mode === state.mode ? 'true' : 'false'}" class="${
                mode === state.mode ? 'active' : ''
              }" data-mode="${mode}">${escapeHtml(mode)}</button>`
          )
          .join('')}
      </div>
    </header>

    <section class="overall-progress">
      <div>
        <span>Overall Completion</span>
        <strong id="overallCount" data-value="0">0%</strong>
      </div>
      <div class="overall-track" aria-hidden="true">
        <div class="overall-fill" style="width:${overall}%"></div>
      </div>
    </section>

    <section class="task-list">
      ${state.tasks
        .map((task, idx) => {
          const open = state.openId === task.id;
          return `
            <article class="task-card ${open ? 'open' : ''}" data-id="${escapeHtml(task.id)}">
              <button type="button" class="task-head" data-toggle="${escapeHtml(task.id)}" aria-expanded="${open}">
                <div class="task-main">
                  ${
                    state.mode === 'Edit'
                      ? `<input class="inline-edit" data-name="${escapeHtml(task.id)}" value="${escapeHtml(task.name)}" />`
                      : `<h2>${escapeHtml(task.name)}</h2>`
                  }
                  <p>${escapeHtml(task.notes)}</p>
                </div>
                <div class="task-stats">
                  <span class="count" data-target="${task.progress}" data-duration="${1200 + idx * 180}">0%</span>
                  <span class="chevron ${open ? 'up' : ''}">⌄</span>
                </div>
              </button>

              <div class="task-progress-track" aria-hidden="true">
                <div class="task-progress-fill" style="width:${task.progress}%"></div>
              </div>

              <div class="task-body" style="max-height:${open ? '420px' : '0px'}">
                <ul>
                  ${task.items
                    .map(
                      (item) => `
                    <li>
                      <label>
                        <input type="checkbox" data-check="${escapeHtml(task.id)}:${escapeHtml(item.id)}" ${
                        item.done ? 'checked' : ''
                      } ${state.mode === 'View' ? 'disabled' : ''} />
                        <span>${escapeHtml(item.title)}</span>
                      </label>
                    </li>`
                    )
                    .join('')}
                </ul>

                ${
                  state.mode === 'Quick Update' || state.mode === 'Edit'
                    ? `<label class="range-wrap">Progress override
                        <input type="range" min="0" max="100" value="${task.progress}" data-progress="${escapeHtml(task.id)}" />
                      </label>`
                    : ''
                }
              </div>
            </article>
          `;
        })
        .join('')}
    </section>
  `;

  bindEvents();
  animateCount(document.getElementById('overallCount'), overall, 1600);
  document.querySelectorAll('.count').forEach((el) => {
    animateCount(el, Number(el.dataset.target), Number(el.dataset.duration));
  });
}

function bindEvents() {
  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      state.mode = button.dataset.mode;
      render();
    });
  });

  document.querySelectorAll('[data-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.toggle;
      state.openId = state.openId === id ? '' : id;
      render();
    });
  });

  const titleInput = document.getElementById('titleInput');
  if (titleInput) {
    titleInput.addEventListener('input', (event) => {
      state.title = event.target.value;
    });
  }

  document.querySelectorAll('[data-name]').forEach((input) => {
    ['click', 'mousedown', 'pointerdown', 'keydown', 'focus'].forEach((eventName) => {
      input.addEventListener(eventName, (event) => {
        event.stopPropagation();
      });
    });

    input.addEventListener('input', (event) => {
      const task = state.tasks.find((entry) => entry.id === input.dataset.name);
      if (!task) return;
      task.name = event.target.value;
    });
  });

  document.querySelectorAll('[data-check]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const [taskId, itemId] = checkbox.dataset.check.split(':');
      const task = state.tasks.find((entry) => entry.id === taskId);
      if (!task) return;
      const item = task.items.find((entry) => entry.id === itemId);
      if (!item) return;

      item.done = checkbox.checked;
      const doneCount = task.items.filter((entry) => entry.done).length;
      task.progress = Math.round((doneCount / task.items.length) * 100);
      render();
    });
  });

  document.querySelectorAll('[data-progress]').forEach((slider) => {
    slider.addEventListener('input', () => {
      const task = state.tasks.find((entry) => entry.id === slider.dataset.progress);
      if (!task) return;
      task.progress = Number(slider.value);
      render();
    });
  });
}

render();
