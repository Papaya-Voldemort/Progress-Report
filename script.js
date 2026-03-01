(() => {
  "use strict";

  const STORAGE_KEY = "progress-report-studio-v1";

  /** @type {{projects: Project[], selectedProjectId: string | null}} */
  let state = {
    projects: [],
    selectedProjectId: null,
  };

  /** @typedef {{ id: string, title: string, notes: string, createdAt: string, updatedAt: string, tasks: Task[] }} Project */
  /** @typedef {{ id: string, title: string, completed: boolean, subtasks: Subtask[], createdAt: string, updatedAt: string }} Task */
  /** @typedef {{ id: string, title: string, completed: boolean, createdAt: string, updatedAt: string }} Subtask */

  const el = {
    appShell: document.getElementById("app-shell"),
    projectList: document.getElementById("project-list"),
    addProjectBtn: document.getElementById("add-project-btn"),
    projectFeedback: document.getElementById("project-feedback"),
    heroStats: document.getElementById("hero-stats"),

    emptyDetails: document.getElementById("empty-details"),
    projectDetails: document.getElementById("project-details"),
    detailProjectName: document.getElementById("detail-project-name"),
    detailProgress: document.getElementById("detail-progress"),
    detailProgressFill: document.getElementById("detail-progress-fill"),
    projectNotes: document.getElementById("project-notes"),
    noteStatus: document.getElementById("note-status"),

    addTaskBtn: document.getElementById("add-task-btn"),
    taskList: document.getElementById("task-list"),
    taskFeedback: document.getElementById("task-feedback"),

    renameProjectBtn: document.getElementById("rename-project-btn"),
    deleteProjectBtn: document.getElementById("delete-project-btn"),

    projectItemTemplate: document.getElementById("project-item-template"),
    taskItemTemplate: document.getElementById("task-item-template"),
  };

  const debounceMap = new Map();

  function init() {
    loadState();
    bindEvents();
    render();
  }

  function bindEvents() {
    el.addProjectBtn.addEventListener("click", onAddProject);
    el.addTaskBtn.addEventListener("click", onAddTask);
    el.renameProjectBtn.addEventListener("click", onRenameProject);
    el.deleteProjectBtn.addEventListener("click", onDeleteProject);

    el.projectNotes.addEventListener("input", () => {
      const project = getSelectedProject();
      if (!project) {
        return;
      }
      project.notes = safeString(el.projectNotes.value, 4000);
      project.updatedAt = nowISO();
      queueSave("notes", () => {
        persistState();
        setInlineStatus("Notes saved.");
      }, 400);
      setInlineStatus("Saving notes...");
    });

    el.taskList.addEventListener("click", onTaskListClick);
    el.taskList.addEventListener("change", onTaskListChange);
  }

  function onAddProject() {
    const title = askForTitle("Enter a project name", "New Project");
    if (!title) {
      setFeedback(el.projectFeedback, "Project creation canceled.");
      return;
    }

    const project = {
      id: uid(),
      title,
      notes: "",
      createdAt: nowISO(),
      updatedAt: nowISO(),
      tasks: [],
    };

    state.projects.unshift(project);
    state.selectedProjectId = project.id;
    persistState();
    setFeedback(el.projectFeedback, "Project created successfully.", "success");
    render();
  }

  function onRenameProject() {
    const project = getSelectedProject();
    if (!project) {
      setFeedback(el.taskFeedback, "Select a project first.", "error");
      return;
    }

    const title = askForTitle("Rename project", project.title);
    if (!title || title === project.title) {
      return;
    }

    project.title = title;
    project.updatedAt = nowISO();
    persistState();
    render();
  }

  function onDeleteProject() {
    const project = getSelectedProject();
    if (!project) {
      setFeedback(el.taskFeedback, "No project to delete.", "error");
      return;
    }

    const ok = window.confirm(`Delete project "${project.title}"? This cannot be undone.`);
    if (!ok) {
      return;
    }

    const index = state.projects.findIndex((item) => item.id === project.id);
    if (index < 0) {
      return;
    }

    state.projects.splice(index, 1);
    if (!state.projects.length) {
      state.selectedProjectId = null;
    } else if (state.selectedProjectId === project.id) {
      state.selectedProjectId = state.projects[Math.max(0, index - 1)].id;
    }

    persistState();
    render();
  }

  function onAddTask() {
    const project = getSelectedProject();
    if (!project) {
      setFeedback(el.taskFeedback, "Select a project before adding tasks.", "error");
      return;
    }

    const title = askForTitle("Task name", "New Task");
    if (!title) {
      setFeedback(el.taskFeedback, "Task creation canceled.");
      return;
    }

    project.tasks.unshift({
      id: uid(),
      title,
      completed: false,
      subtasks: [],
      createdAt: nowISO(),
      updatedAt: nowISO(),
    });

    project.updatedAt = nowISO();
    persistState();
    setFeedback(el.taskFeedback, "Task added.", "success");
    render();
  }

  function onTaskListClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const taskItem = target.closest(".task-item");
    if (!taskItem) {
      return;
    }

    const taskId = taskItem.getAttribute("data-task-id");
    if (!taskId) {
      return;
    }

    if (target.classList.contains("add-subtask")) {
      addSubtask(taskId);
    } else if (target.classList.contains("rename-task")) {
      renameTask(taskId);
    } else if (target.classList.contains("delete-task")) {
      deleteTask(taskId);
    } else if (target.classList.contains("rename-subtask")) {
      renameSubtask(taskId, target.getAttribute("data-subtask-id"));
    } else if (target.classList.contains("delete-subtask")) {
      deleteSubtask(taskId, target.getAttribute("data-subtask-id"));
    }
  }

  function onTaskListChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const taskId = target.getAttribute("data-task-id");
    if (!taskId) {
      return;
    }

    if (target.classList.contains("task-toggle")) {
      toggleTask(taskId, target.checked);
      return;
    }

    if (target.classList.contains("subtask-toggle")) {
      const subtaskId = target.getAttribute("data-subtask-id");
      toggleSubtask(taskId, subtaskId, target.checked);
    }
  }

  function addSubtask(taskId) {
    const task = getTask(taskId);
    if (!task) {
      setFeedback(el.taskFeedback, "Task not found.", "error");
      return;
    }

    const title = askForTitle("Subtask name", "New Subtask");
    if (!title) {
      return;
    }

    task.subtasks.push({
      id: uid(),
      title,
      completed: false,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    });

    task.updatedAt = nowISO();
    syncTaskCompletionFromSubtasks(task);
    saveProjectAndRender();
  }

  function renameTask(taskId) {
    const task = getTask(taskId);
    if (!task) {
      return;
    }
    const title = askForTitle("Rename task", task.title);
    if (!title || title === task.title) {
      return;
    }
    task.title = title;
    task.updatedAt = nowISO();
    saveProjectAndRender();
  }

  function deleteTask(taskId) {
    const project = getSelectedProject();
    if (!project) {
      return;
    }

    const task = getTask(taskId);
    if (!task) {
      return;
    }

    if (!window.confirm(`Delete task "${task.title}"?`)) {
      return;
    }

    project.tasks = project.tasks.filter((item) => item.id !== taskId);
    project.updatedAt = nowISO();
    persistState();
    render();
  }

  function renameSubtask(taskId, subtaskId) {
    const subtask = getSubtask(taskId, subtaskId);
    if (!subtask) {
      return;
    }
    const title = askForTitle("Rename subtask", subtask.title);
    if (!title || title === subtask.title) {
      return;
    }
    subtask.title = title;
    subtask.updatedAt = nowISO();
    saveProjectAndRender();
  }

  function deleteSubtask(taskId, subtaskId) {
    if (!subtaskId) {
      return;
    }
    const task = getTask(taskId);
    if (!task) {
      return;
    }

    const subtask = task.subtasks.find((item) => item.id === subtaskId);
    if (!subtask) {
      return;
    }

    if (!window.confirm(`Delete subtask "${subtask.title}"?`)) {
      return;
    }

    task.subtasks = task.subtasks.filter((item) => item.id !== subtaskId);
    task.updatedAt = nowISO();
    syncTaskCompletionFromSubtasks(task);
    saveProjectAndRender();
  }

  function toggleTask(taskId, checked) {
    const task = getTask(taskId);
    if (!task) {
      return;
    }

    task.completed = checked;
    task.updatedAt = nowISO();

    if (task.subtasks.length) {
      task.subtasks = task.subtasks.map((subtask) => ({
        ...subtask,
        completed: checked,
        updatedAt: nowISO(),
      }));
    }

    saveProjectAndRender();
  }

  function toggleSubtask(taskId, subtaskId, checked) {
    const task = getTask(taskId);
    if (!task || !subtaskId) {
      return;
    }

    const subtask = task.subtasks.find((item) => item.id === subtaskId);
    if (!subtask) {
      return;
    }

    subtask.completed = checked;
    subtask.updatedAt = nowISO();
    task.updatedAt = nowISO();
    syncTaskCompletionFromSubtasks(task);
    saveProjectAndRender();
  }

  function syncTaskCompletionFromSubtasks(task) {
    if (!task.subtasks.length) {
      return;
    }
    task.completed = task.subtasks.every((subtask) => Boolean(subtask.completed));
  }

  function saveProjectAndRender() {
    const project = getSelectedProject();
    if (!project) {
      return;
    }
    project.updatedAt = nowISO();
    persistState();
    render();
  }

  function render() {
    ensureSelectedProject();
    renderProjectList();
    renderHeroStats();
    renderDetails();
  }

  function renderProjectList() {
    el.projectList.innerHTML = "";

    if (!state.projects.length) {
      el.projectList.innerHTML = `<li class="empty-state"><p>No projects yet. Start by adding one.</p></li>`;
      return;
    }

    for (const project of state.projects) {
      const node = el.projectItemTemplate.content.firstElementChild.cloneNode(true);
      const button = node.querySelector(".project-select");
      const title = node.querySelector(".project-title");
      const percent = node.querySelector(".project-percent");
      const fill = node.querySelector(".progress-fill");
      const meta = node.querySelector(".project-meta");

      const progress = getProjectProgress(project);
      title.textContent = project.title;
      percent.textContent = `${progress}%`;
      fill.style.width = `${progress}%`;
      meta.textContent = `${project.tasks.length} task${project.tasks.length === 1 ? "" : "s"} • Updated ${formatDate(project.updatedAt)}`;

      if (project.id === state.selectedProjectId) {
        button.classList.add("active");
      }

      button.addEventListener("click", () => {
        state.selectedProjectId = project.id;
        persistState();
        render();
      });

      el.projectList.append(node);
    }
  }

  function renderHeroStats() {
    const projectCount = state.projects.length;
    const allTasks = state.projects.flatMap((project) => project.tasks);
    const completedTasks = allTasks.filter((task) => task.completed).length;
    const globalProgress = projectCount
      ? Math.round(state.projects.reduce((acc, project) => acc + getProjectProgress(project), 0) / projectCount)
      : 0;

    el.heroStats.innerHTML = "";
    const stats = [
      { label: "Projects", value: projectCount },
      { label: "Completed Tasks", value: completedTasks },
      { label: "Average Progress", value: `${globalProgress}%` },
    ];

    for (const item of stats) {
      const stat = document.createElement("div");
      stat.className = "hero-stat";
      stat.innerHTML = `<strong>${escapeHtml(String(item.value))}</strong><span>${escapeHtml(item.label)}</span>`;
      el.heroStats.append(stat);
    }
  }

  function renderDetails() {
    const project = getSelectedProject();

    if (!project) {
      el.emptyDetails.classList.remove("hidden");
      el.projectDetails.classList.add("hidden");
      return;
    }

    el.emptyDetails.classList.add("hidden");
    el.projectDetails.classList.remove("hidden");

    const progress = getProjectProgress(project);
    el.detailProjectName.textContent = project.title;
    el.detailProgress.textContent = `${progress}% complete`;
    el.detailProgressFill.style.width = `${progress}%`;

    if (el.projectNotes.value !== project.notes) {
      el.projectNotes.value = project.notes;
    }

    renderTasks(project);
  }

  function renderTasks(project) {
    el.taskList.innerHTML = "";

    if (!project.tasks.length) {
      el.taskList.innerHTML = `<li class="empty-state"><p>No tasks yet. Add one to start tracking.</p></li>`;
      return;
    }

    for (const task of project.tasks) {
      const node = el.taskItemTemplate.content.firstElementChild.cloneNode(true);
      node.setAttribute("data-task-id", task.id);

      const toggle = node.querySelector(".task-toggle");
      const taskName = node.querySelector(".task-name");
      const percentText = node.querySelector(".task-percent");
      const subtaskList = node.querySelector(".subtask-list");

      toggle.checked = Boolean(task.completed);
      toggle.setAttribute("data-task-id", task.id);
      taskName.textContent = task.title;

      const subtaskPercent = getTaskSubtaskProgress(task);
      percentText.textContent = task.subtasks.length
        ? `${subtaskPercent}% of subtasks completed`
        : task.completed
          ? "Marked complete"
          : "Not started";

      if (!task.subtasks.length) {
        const hint = document.createElement("li");
        hint.className = "subtask-item";
        hint.innerHTML = `<small style="color: var(--muted);">No subtasks yet.</small>`;
        subtaskList.append(hint);
      } else {
        for (const subtask of task.subtasks) {
          const li = document.createElement("li");
          li.className = "subtask-item";
          li.innerHTML = `
            <label class="checkbox-row">
              <input
                class="subtask-toggle"
                type="checkbox"
                data-task-id="${escapeHtml(task.id)}"
                data-subtask-id="${escapeHtml(subtask.id)}"
                ${subtask.completed ? "checked" : ""}
              />
              <span>${escapeHtml(subtask.title)}</span>
            </label>
            <div class="task-actions">
              <button class="icon-btn rename-subtask" data-subtask-id="${escapeHtml(subtask.id)}" title="Rename subtask" aria-label="Rename subtask">✎</button>
              <button class="icon-btn delete-subtask" data-subtask-id="${escapeHtml(subtask.id)}" title="Delete subtask" aria-label="Delete subtask">🗑</button>
            </div>
          `;
          subtaskList.append(li);
        }
      }

      el.taskList.append(node);
    }
  }

  function getProjectProgress(project) {
    if (!project.tasks.length) {
      return 0;
    }

    const taskProgress = project.tasks.map((task) => {
      if (!task.subtasks.length) {
        return task.completed ? 100 : 0;
      }
      return getTaskSubtaskProgress(task);
    });

    return Math.round(taskProgress.reduce((acc, value) => acc + value, 0) / taskProgress.length);
  }

  function getTaskSubtaskProgress(task) {
    if (!task.subtasks.length) {
      return task.completed ? 100 : 0;
    }

    const completed = task.subtasks.filter((subtask) => Boolean(subtask.completed)).length;
    return Math.round((completed / task.subtasks.length) * 100);
  }

  function getSelectedProject() {
    return state.projects.find((project) => project.id === state.selectedProjectId) ?? null;
  }

  function getTask(taskId) {
    const project = getSelectedProject();
    if (!project) {
      return null;
    }
    return project.tasks.find((task) => task.id === taskId) ?? null;
  }

  function getSubtask(taskId, subtaskId) {
    const task = getTask(taskId);
    if (!task || !subtaskId) {
      return null;
    }
    return task.subtasks.find((subtask) => subtask.id === subtaskId) ?? null;
  }

  function askForTitle(message, defaultValue = "") {
    const raw = window.prompt(message, defaultValue);
    if (raw === null) {
      return null;
    }

    const title = safeString(raw, 120);
    if (!title) {
      window.alert("Please enter a non-empty value.");
      return null;
    }

    return title;
  }

  function safeString(value, maxLength) {
    if (typeof value !== "string") {
      return "";
    }
    return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  }

  function setFeedback(node, message, type = "") {
    node.textContent = message;
    node.className = `feedback ${type}`.trim();
  }

  function setInlineStatus(message) {
    el.noteStatus.textContent = message;
    queueSave("clear-note-status", () => {
      el.noteStatus.textContent = "";
    }, 1300);
  }

  function ensureSelectedProject() {
    if (!state.projects.length) {
      state.selectedProjectId = null;
      return;
    }

    const exists = state.projects.some((project) => project.id === state.selectedProjectId);
    if (!exists) {
      state.selectedProjectId = state.projects[0].id;
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      state = sanitizeState(parsed);
    } catch (error) {
      console.error("Failed to load state:", error);
      state = { projects: [], selectedProjectId: null };
      setFeedback(el.projectFeedback, "Saved data was invalid and has been safely reset.", "error");
    }
  }

  function sanitizeState(raw) {
    if (!raw || typeof raw !== "object") {
      return { projects: [], selectedProjectId: null };
    }

    const rawProjects = Array.isArray(raw.projects) ? raw.projects : [];
    const projects = rawProjects
      .map((project) => sanitizeProject(project))
      .filter((project) => project && project.id && project.title);

    const selectedProjectId = typeof raw.selectedProjectId === "string" ? raw.selectedProjectId : null;

    return {
      projects,
      selectedProjectId,
    };
  }

  function sanitizeProject(project) {
    if (!project || typeof project !== "object") {
      return null;
    }

    return {
      id: ensureId(project.id),
      title: safeString(String(project.title || "Untitled Project"), 120) || "Untitled Project",
      notes: safeString(String(project.notes || ""), 4000),
      createdAt: safeDate(project.createdAt),
      updatedAt: safeDate(project.updatedAt),
      tasks: Array.isArray(project.tasks) ? project.tasks.map((task) => sanitizeTask(task)).filter(Boolean) : [],
    };
  }

  function sanitizeTask(task) {
    if (!task || typeof task !== "object") {
      return null;
    }

    const sanitized = {
      id: ensureId(task.id),
      title: safeString(String(task.title || "Untitled Task"), 120) || "Untitled Task",
      completed: Boolean(task.completed),
      createdAt: safeDate(task.createdAt),
      updatedAt: safeDate(task.updatedAt),
      subtasks: Array.isArray(task.subtasks)
        ? task.subtasks.map((subtask) => sanitizeSubtask(subtask)).filter(Boolean)
        : [],
    };

    if (sanitized.subtasks.length) {
      sanitized.completed = sanitized.subtasks.every((subtask) => subtask.completed);
    }

    return sanitized;
  }

  function sanitizeSubtask(subtask) {
    if (!subtask || typeof subtask !== "object") {
      return null;
    }

    return {
      id: ensureId(subtask.id),
      title: safeString(String(subtask.title || "Untitled Subtask"), 120) || "Untitled Subtask",
      completed: Boolean(subtask.completed),
      createdAt: safeDate(subtask.createdAt),
      updatedAt: safeDate(subtask.updatedAt),
    };
  }

  function safeDate(value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? nowISO() : parsed.toISOString();
  }

  function persistState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Failed to save state:", error);
      setFeedback(el.projectFeedback, "Unable to save data in this browser environment.", "error");
    }
  }

  function queueSave(key, callback, delay) {
    const existing = debounceMap.get(key);
    if (existing) {
      window.clearTimeout(existing);
    }
    const timeoutId = window.setTimeout(() => {
      callback();
      debounceMap.delete(key);
    }, delay);
    debounceMap.set(key, timeoutId);
  }

  function uid() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `id-${Math.random().toString(16).slice(2)}-${Date.now()}`;
  }

  function ensureId(value) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    return uid();
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function formatDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return "just now";
    }
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function escapeHtml(text) {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  init();
})();
