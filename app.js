(() => {
  "use strict";

  const DEFAULT_MODEL = "qwen3.5:0.8b";
  const STORAGE = { notes: "naturebuddy-notes-v1", sessions: "naturebuddy-sessions-v1", plans: "naturebuddy-plans-v1" };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  let selectedActivity = "Mindful walk";
  let currentPlan = null;
  let localAIState = "checking";
  let toastTimer = 0;

  const activityTemplates = {
    "Mindful walk": [
      "Start at an easy pace on a familiar, public route. Notice how the ground looks and feels underfoot.",
      "Pause somewhere safe. Listen for one nearby sound, one farther away, and one you almost missed.",
      "Take your usual route back. See whether one ordinary detail looks different now."
    ],
    "Birdwatching": [
      "Choose a safe place to stand or sit, then listen quietly before looking around.",
      "Notice birds from a respectful distance: movement, silhouette, colour, or the rhythm of a call.",
      "Watch how the birds use the space around them. Leave nests and wildlife undisturbed."
    ],
    "Garden time": [
      "Take a slow look around your plants before changing anything. Notice light and shade.",
      "Choose one plant and look for leaf patterns, new growth, soil texture, or tiny visitors.",
      "Water or tidy only where needed. Leave insects, fallen leaves, and wildlife undisturbed where possible."
    ],
    "Nature photography": [
      "Find three textures nearby, such as bark, leaf veins, a stone, or a patch of light.",
      "Frame one close-up and one wide scene from a safe, stable spot on the path.",
      "Choose a favourite detail, then put the camera away and look at it with your own eyes."
    ],
    "Cloud watching": [
      "Find a comfortable, safe place with a view of the sky. Settle your attention for a moment.",
      "Watch how the edges and shapes of the clouds change. Give one a made-up name if you like.",
      "Look from the sky to the trees or buildings and notice how the light differs."
    ],
    "Outdoor reset": [
      "Begin at a comfortable pace in a familiar outdoor place. Let your eyes take in the wider view.",
      "Pause safely and notice the breeze, ambient sounds, and the feeling of the air on your skin.",
      "Finish gently and choose an easy route back. There is nothing to achieve or prove."
    ]
  };

  const ideaBank = {
    "Mindful walk": ["The sound map", "Follow one sense at a time"],
    "Birdwatching": ["Birds, not names", "Listen before you look"],
    "Garden time": ["One plant, full attention", "Notice a new leaf"],
    "Nature photography": ["Texture hunt", "Nature’s patterns"],
    "Cloud watching": ["Cloud postcards", "Follow the changing light"],
    "Outdoor reset": ["The familiar loop", "Five shades of green"]
  };

  function readStorage(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      showToast("Browser storage is unavailable. Your change may not be saved.");
      return false;
    }
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2700);
  }

  function escapeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function getDetails() {
    return {
      activity: selectedActivity,
      place: $("#place").value,
      duration: Number($("#duration").value),
      focus: $("input[name='focus']:checked").value
    };
  }

  function minutesFor(duration) {
    const first = Math.max(2, Math.round(duration * 0.25));
    const second = Math.max(3, Math.round(duration * 0.45));
    return [first, second, Math.max(2, duration - first - second)];
  }

  function makeFallbackPlan(details) {
    const steps = activityTemplates[details.activity] || activityTemplates["Mindful walk"];
    const times = minutesFor(details.duration);
    const focusLines = {
      Calm: "No need to get anywhere quickly. Let the small details come to you.",
      Curious: "Treat the ordinary like a mystery. You do not need to name everything to notice it.",
      Playful: "Give yourself permission to invent a tiny challenge and enjoy whatever you find.",
      "Move a little": "Keep the pace comfortable and choose steady, easy movement over effort."
    };
    return {
      title: ({ "Mindful walk": "The art of wandering", Birdwatching: "A little bird curiosity", "Garden time": "A closer look at green", "Nature photography": "Find a different frame", "Cloud watching": "A sky with no schedule", "Outdoor reset": "A softer kind of reset" })[details.activity] || "Your tiny nature adventure",
      mission: `${focusLines[details.focus] || focusLines.Calm} Try this in ${details.place.toLowerCase()}.`,
      steps: steps.map((copy, index) => ({ time: times[index], copy })),
      notices: getNotices(details),
      safety: "Stay in familiar, public places; watch your footing and traffic; leave plants and wildlife as you found them.",
      source: "On-device starter guide"
    };
  }

  function getNotices(details) {
    const notices = {
      "Mindful walk": ["A sound nearby", "A sound far away", "One unexpected detail"],
      Birdwatching: ["A call or rhythm", "A wing or tail shape", "Movement in the trees"],
      "Garden time": ["Leaf patterns", "Light and shade", "A tiny visitor"],
      "Nature photography": ["A rough texture", "A soft edge", "A surprising colour"],
      "Cloud watching": ["A changing shape", "A patch of blue", "A shift in light"],
      "Outdoor reset": ["The feel of the air", "A steady sound", "A comfortable view"]
    };
    const selected = (notices[details.activity] || notices["Mindful walk"]).slice();
    if (details.focus === "Curious") selected[2] = "Something you can’t name yet";
    if (details.focus === "Playful") selected[2] = "A tiny made-up story";
    return selected;
  }

  function makePrompt(details) {
    return `Create a friendly, practical outdoor micro-adventure that encourages less screen time.\n\nActivity: ${details.activity}\nSetting: ${details.place}\nTime available: ${details.duration} minutes\nVibe: ${details.focus}\n\nReturn concise plain text in this exact format:\nTITLE: short playful title\nMISSION: one encouraging sentence\nSTEPS:\n1. N min — first step\n2. N min — second step\n3. N min — third step\nNOTICE: three short things separated by commas\nSAFETY: one practical reminder\n\nThe three step times must add up to ${details.duration} minutes. Keep it beginner-friendly, inclusive, safe and under 180 words. Do not invent weather, local species, growing dates, or real-time location facts. Never encourage trespass, approaching wildlife, entering water, going somewhere isolated, or using a phone while moving. Keep the screen the shortest part of the experience.`;
  }

  function parseAIPlan(raw, details) {
    const text = String(raw || "").trim();
    const readField = (name) => {
      const match = text.match(new RegExp(`^${name}\\s*:\\s*(.*)$`, "im"));
      return match ? match[1].trim() : "";
    };
    const section = (name, nextNames) => {
      const names = [name, ...nextNames].join("|");
      const match = text.match(new RegExp(`^${name}\\s*:\\s*([\\s\\S]*?)(?=^(?:${nextNames.join("|")})\\s*:|$)`, "im"));
      return match ? match[1].trim() : "";
    };
    const stepText = section("STEPS", ["NOTICE", "SAFETY"]);
    const steps = stepText.split(/\n+/).map((line) => {
      const match = line.match(/^\s*\d+[.)-]?\s*(?:(\d+)\s*(?:min(?:ute)?s?)\s*[—–-]\s*)?(.+)$/i);
      return match ? { time: Number(match[1] || 0), copy: match[2].trim() } : null;
    }).filter((step) => step && step.copy);
    if (steps.length < 2) return makeFallbackPlan(details);
    const noticesText = section("NOTICE", ["SAFETY"]);
    const notices = noticesText.split(/[,;\n•]+/).map((item) => item.replace(/^\s*[-*]\s*/, "").trim()).filter(Boolean).slice(0, 4);
    const aiSafety = readField("SAFETY");
    return {
      title: readField("TITLE") || "Your tiny nature adventure",
      mission: readField("MISSION") || "A small invitation to step outside and notice something new.",
      steps: steps.slice(0, 4).map((step) => ({ time: step.time, copy: step.copy })),
      notices: notices.length ? notices : getNotices(details),
      safety: aiSafety || "Stay in a familiar public place and leave nature undisturbed.",
      source: `Created by ${DEFAULT_MODEL} · on your computer`
    };
  }

  async function askLocalModel(details) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [
        { role: "system", content: "You are NatureBuddy, an outdoor companion. Encourage real-world experiences with safe, grounded, concise ideas. Do not invent current conditions or location-specific facts. Follow the user's response format exactly." },
        { role: "user", content: makePrompt(details) }
      ], options: { temperature: 0.65, num_predict: 320 } }),
      signal: AbortSignal.timeout(90000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The local model could not answer.");
    const content = data?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("The local model returned an empty answer.");
    return parseAIPlan(content, details);
  }

  function renderPlan(plan, details) {
    currentPlan = { ...plan, activity: details.activity, duration: details.duration, place: details.place, focus: details.focus };
    $("#emptyPlan").classList.add("hidden");
    $("#planContent").classList.remove("hidden");
    $("#guideTitle").textContent = plan.title;
    $("#planMission").textContent = plan.mission;
    $("#planTime").textContent = `${details.duration} MINUTES`;
    $("#planOrigin").lastChild.textContent = ` ${plan.source}`;
    $("#planBadge").textContent = details.activity.toUpperCase();
    const steps = $("#planSteps");
    steps.replaceChildren();
    plan.steps.forEach((step, index) => {
      const li = document.createElement("li");
      li.className = "step-item";
      const number = document.createElement("span");
      number.className = "step-number";
      number.textContent = String(index + 1).padStart(2, "0");
      const copy = document.createElement("span");
      copy.className = "step-copy";
      copy.textContent = step.copy;
      const time = document.createElement("span");
      time.className = "step-time";
      time.textContent = step.time ? `${step.time} min` : "";
      li.append(number, copy, time);
      steps.append(li);
    });
    const observeList = $("#observeList");
    observeList.replaceChildren();
    plan.notices.slice(0, 4).forEach((notice) => {
      const span = document.createElement("span");
      span.className = "observe-chip";
      span.textContent = notice;
      observeList.append(span);
    });
    let safety = $("#planSafety");
    if (!safety) {
      safety = document.createElement("div");
      safety.id = "planSafety";
      safety.className = "safety-note";
      safety.innerHTML = '<span aria-hidden="true">🌼</span><div><strong>A gentle reminder</strong><p id="safetyCopy"></p></div>';
      $("#observeList").closest(".observe-box").after(safety);
    }
    $("#safetyCopy", safety).textContent = plan.safety;
    $("#markDone").textContent = "Done outside";
    $("#markDone").disabled = false;
  }

  function savePlan() {
    if (!currentPlan) return;
    const notes = readStorage(STORAGE.notes, []);
    const stepsText = currentPlan.steps.map((step, index) => `${index + 1}. ${step.time ? `${step.time} min — ` : ""}${step.copy}`).join("\n");
    notes.unshift({ id: makeId(), title: `Plan: ${currentPlan.title}`, text: `${currentPlan.mission}\n\n${stepsText}\n\nLook for: ${currentPlan.notices.join(", ")}\n\nA gentle reminder: ${currentPlan.safety}`, createdAt: new Date().toISOString(), mood: "Field guide" });
    writeStorage(STORAGE.notes, notes.slice(0, 60));
    renderNotes();
    showToast("Plan saved to your field notebook.");
  }

  function markPlanDone() {
    if (!currentPlan) return;
    const sessions = readStorage(STORAGE.sessions, 0) + 1;
    writeStorage(STORAGE.sessions, sessions);
    updateSessions();
    $("#markDone").textContent = "Moment logged ✓";
    $("#markDone").disabled = true;
    showToast("Lovely. One more moment spent outside. 🌿");
  }

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Just now";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  }

  function renderNotes() {
    const notes = readStorage(STORAGE.notes, []);
    const list = $("#notesList");
    list.replaceChildren();
    $("#notesCount").textContent = `${notes.length} ${notes.length === 1 ? "NOTE" : "NOTES"}`;
    if (!notes.length) {
      const empty = document.createElement("div");
      empty.className = "notes-empty";
      empty.innerHTML = "<span>📓</span>Your notebook is waiting for its first little discovery.<br>Save a note after your next outside moment.";
      list.append(empty);
      return;
    }
    notes.slice(0, 8).forEach((note) => {
      const card = document.createElement("article");
      card.className = "note-card";
      const meta = document.createElement("div");
      meta.className = "note-meta";
      const mood = document.createElement("span");
      mood.className = "note-mood";
      mood.textContent = note.mood || "A little moment";
      const date = document.createElement("time");
      date.textContent = formatDate(note.createdAt);
      const title = document.createElement("h4");
      title.textContent = note.title;
      const body = document.createElement("p");
      body.textContent = note.text;
      const remove = document.createElement("button");
      remove.className = "delete-note";
      remove.type = "button";
      remove.setAttribute("aria-label", `Delete note: ${note.title}`);
      remove.title = "Delete this note";
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        const remaining = readStorage(STORAGE.notes, []).filter((item) => item.id !== note.id);
        writeStorage(STORAGE.notes, remaining);
        renderNotes();
        showToast("Note removed from this browser.");
      });
      meta.append(mood, date);
      card.append(meta, remove, title, body);
      list.append(card);
    });
  }

  function updateSessions() {
    const count = readStorage(STORAGE.sessions, 0);
    $("#sessionLabel").textContent = `Your outside moments: ${count}`;
  }

  function selectActivity(activity) {
    selectedActivity = activity;
    $$(".activity-option").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.activity === activity)));
  }

  async function generatePlan(event) {
    event?.preventDefault();
    const details = getDetails();
    const button = $("#generateButton");
    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = "Finding a little wonder…";
    try {
      if (localAIState === "ready") {
        try {
          const plan = await askLocalModel(details);
          renderPlan(plan, details);
          setMode("ready", "Local AI ready");
        } catch (error) {
          console.warn("Local model unavailable; using offline guide.", error.message);
          renderPlan(makeFallbackPlan(details), details);
          setMode("offline", "Offline starter guide");
          showToast("Using the built-in guide. Your adventure is still ready.");
        }
      } else {
        renderPlan(makeFallbackPlan(details), details);
      }
      $("#planPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  }

  function setMode(state, label) {
    localAIState = state;
    $("#modeStatus").textContent = label;
    const dot = $(".status-dot");
    if (dot) dot.style.background = state === "ready" ? "#4b9c6b" : "#82a950";
  }

  async function checkLocalAI() {
    try {
      const response = await fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(2200) });
      if (!response.ok) throw new Error("Local server check failed");
      const status = await response.json();
      if (status.ollama && status.model_available) {
        setMode("ready", "Local AI ready");
      } else if (status.ollama) {
        setMode("offline", "Model not installed");
      } else {
        setMode("offline", "Offline-friendly");
      }
    } catch {
      setMode("offline", "Offline-friendly");
    }
  }

  function addNote(event) {
    event.preventDefault();
    const title = $("#noteTitle").value.trim();
    const text = $("#noteText").value.trim();
    if (!title || !text) return;
    const notes = readStorage(STORAGE.notes, []);
    notes.unshift({ id: makeId(), title, text, createdAt: new Date().toISOString(), mood: "Field note" });
    const saved = writeStorage(STORAGE.notes, notes.slice(0, 60));
    if (saved) {
      $("#noteForm").reset();
      renderNotes();
      showToast("A little moment, kept safe in your notebook.");
    }
  }

  function exportNotes() {
    const notes = readStorage(STORAGE.notes, []);
    if (!notes.length) {
      showToast("Your notebook is empty for now.");
      return;
    }
    const content = ["NatureBuddy — My Field Notebook", "Exported locally from your browser", "", ...notes.map((note) => `${note.title}\n${formatDate(note.createdAt)} · ${note.mood || "Note"}\n${note.text}\n`)].join("\n---\n\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "naturebuddy-field-notes.txt";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Your notes are exported to a text file.");
  }

  function applyIdeaFilters() {
    const active = $(".filter-chip[aria-pressed='true']")?.dataset.filter || "All";
    const query = $("#ideaSearch").value.trim().toLowerCase();
    let shown = 0;
    $$(".idea-card").forEach((card) => {
      const categoryMatch = active === "All" || card.dataset.category === active;
      const searchText = `${card.dataset.search} ${card.textContent}`.toLowerCase();
      const searchMatch = !query || searchText.includes(query);
      const visible = categoryMatch && searchMatch;
      card.classList.toggle("hidden", !visible);
      if (visible) shown++;
    });
    const existing = $("#noIdeas");
    if (shown === 0 && !existing) {
      const noResults = document.createElement("div");
      noResults.className = "no-results";
      noResults.id = "noIdeas";
      noResults.textContent = "No ideas match that search yet. Try another word or choose Everything.";
      $("#ideaGrid").append(noResults);
    } else if (shown > 0 && existing) existing.remove();
  }

  function openHelp() { $("#helpModal").classList.add("open"); $("#closeHelp").focus(); }
  function closeHelp() { $("#helpModal").classList.remove("open"); $("#helpButton").focus(); }

  $$(".activity-option").forEach((button) => button.addEventListener("click", () => selectActivity(button.dataset.activity)));
  $("#plannerForm").addEventListener("submit", generatePlan);
  $("#noteForm").addEventListener("submit", addNote);
  $("#exportNotes").addEventListener("click", exportNotes);
  $("#savePlan").addEventListener("click", savePlan);
  $("#markDone").addEventListener("click", markPlanDone);
  $("#copyPlan").addEventListener("click", async () => {
    if (!currentPlan) return;
    const text = `${currentPlan.title}\n${currentPlan.mission}\n\n${currentPlan.steps.map((step, index) => `${index + 1}. ${step.time ? `${step.time} min — ` : ""}${step.copy}`).join("\n")}\n\nNotice: ${currentPlan.notices.join(", ")}\nSafety: ${currentPlan.safety}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Your tiny adventure is copied.");
    } catch {
      const field = document.createElement("textarea");
      field.value = text;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.append(field);
      field.select();
      const ok = document.execCommand("copy");
      field.remove();
      showToast(ok ? "Your tiny adventure is copied." : "Copy isn’t available in this browser.");
    }
  });
  $$(".filter-chip").forEach((button) => button.addEventListener("click", () => {
    $$(".filter-chip").forEach((chip) => chip.setAttribute("aria-pressed", String(chip === button)));
    applyIdeaFilters();
  }));
  $("#ideaSearch").addEventListener("input", applyIdeaFilters);
  $$(".idea-use").forEach((button) => button.addEventListener("click", () => {
    selectActivity(button.dataset.idea);
    $("#duration").value = button.dataset.duration;
    $("#planner").scrollIntoView({ behavior: "smooth" });
    showToast(`${button.dataset.idea} added to your plan.`);
    window.setTimeout(() => generatePlan(), 280);
  }));
  $("#helpButton").addEventListener("click", openHelp);
  $("#closeHelp").addEventListener("click", closeHelp);
  $("#helpModal").addEventListener("click", (event) => { if (event.target === $("#helpModal")) closeHelp(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && $("#helpModal").classList.contains("open")) closeHelp(); });

  renderNotes();
  updateSessions();
  checkLocalAI();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
  }
})();
