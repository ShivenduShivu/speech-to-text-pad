// script.js - Speech-to-Text Pad using Web Speech API (SpeechRecognition)
// Adds smart punctuation + basic sentence capitalization.

document.addEventListener("DOMContentLoaded", () => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  const supportBadge = document.getElementById("supportBadge");
  const micButton = document.getElementById("micButton");
  const micIndicator = document.getElementById("micIndicator");
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const clearBtn = document.getElementById("clearBtn");
  const saveNoteBtn = document.getElementById("saveNoteBtn");
  const textOutput = document.getElementById("textOutput");
  const errorArea = document.getElementById("errorArea");
  const notesList = document.getElementById("notesList");
  const noteCount = document.getElementById("noteCount");
  const hintLabel = document.getElementById("hintLabel");

  let recognition = null;
  let isListening = false;
  let finalText = ""; // accumulated "cleaned" transcript

  // Update hint to show voice punctuation help
  if (hintLabel) {
    hintLabel.textContent = 'Tip: say "comma", "period", "question mark", or "new line" for punctuation.';
  }

  // ---- smart formatting ----
  function smartFormat(text) {
    if (!text) return "";

    let t = text;

    // Replace voice punctuation words by symbols
    const subs = [
      { re: /\bcomma\b/gi, to: "," },
      { re: /\bperiod\b|\bfull stop\b/gi, to: "." },
      { re: /\bquestion mark\b/gi, to: "?" },
      { re: /\bexclamation (?:mark|point)\b/gi, to: "!" },
      { re: /\bnew line\b|\bnewline\b/gi, to: "\n" }
    ];

    subs.forEach(({ re, to }) => {
      t = t.replace(re, to);
    });

    // Remove extra spaces before punctuation: "word ," -> "word,"
    t = t.replace(/[ \t]+([,\.!?])/g, "$1");

    // Ensure space after punctuation if followed by a word (not newline)
    t = t.replace(/([,\.!?])([^\s\n])/g, "$1 $2");

    // Trim spaces around each line
    t = t
      .split("\n")
      .map((line) => line.trim())
      .join("\n");

    // Capitalize the first letter of each sentence
    // e.g. "hello. how are you?" -> "Hello. How are you?"
    t = t.replace(/(^|[\.\!\?]\s+)([a-z])/g, (match, prefix, letter) => {
      return prefix + letter.toUpperCase();
    });

    return t.trim();
  }

  // ---- check support ----
  if (!SpeechRecognition) {
    supportBadge.textContent = "SpeechRecognition not supported 🥲";
    supportBadge.style.color = "#fb7185";
    supportBadge.style.borderColor = "rgba(248, 113, 113, 0.7)";
    errorArea.textContent =
      "Your browser does not support the SpeechRecognition API. Try Chrome or Edge.";
    disableMic();
    return;
  } else {
    supportBadge.textContent = "SpeechRecognition ready ✅";
  }

  // ---- setup recognition ----
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    isListening = true;
    updateMicUI();
    errorArea.textContent = "";
  };

  recognition.onend = () => {
    isListening = false;
    updateMicUI();
    // When it ends, clean up the final text once more
    finalText = smartFormat(textOutput.value);
    textOutput.value = finalText;
  };

  recognition.onerror = (event) => {
    errorArea.textContent = "Error: " + (event.error || "unknown");
    isListening = false;
    updateMicUI();
  };

  recognition.onresult = (event) => {
    let interimRaw = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      if (res.isFinal) {
        const piece = res[0].transcript.trim();
        finalText = finalText
          ? finalText + " " + piece
          : piece;
        finalText = smartFormat(finalText);
      } else {
        interimRaw += res[0].transcript;
      }
    }

    let display;
    if (interimRaw) {
      const combined = finalText
        ? finalText + " " + interimRaw
        : interimRaw;
      display = smartFormat(combined);
    } else {
      display = finalText;
    }

    textOutput.value = display;
    textOutput.scrollTop = textOutput.scrollHeight;
  };

  // ---- UI helpers ----
  function updateMicUI() {
    if (isListening) {
      micButton.classList.add("listening");
      micIndicator.textContent = "Listening…";
      micIndicator.classList.remove("mic-off");
      micIndicator.classList.add("mic-on");

      startBtn.disabled = true;
      stopBtn.disabled = false;
    } else {
      micButton.classList.remove("listening");
      micIndicator.textContent = "Idle";
      micIndicator.classList.remove("mic-on");
      micIndicator.classList.add("mic-off");

      startBtn.disabled = false;
      stopBtn.disabled = true;
    }
  }

  function disableMic() {
    startBtn.disabled = true;
    stopBtn.disabled = true;
    micButton.disabled = true;
    micIndicator.textContent = "Not available";
  }

  function resetTranscript() {
    finalText = "";
    textOutput.value = "";
    errorArea.textContent = "";
  }

  // ---- notes ----
  let notes = [];

  function updateNoteCount() {
    noteCount.textContent =
      notes.length === 1 ? "1 note" : `${notes.length} notes`;
  }

  function renderNotes() {
    notesList.innerHTML = "";
    if (notes.length === 0) {
      notesList.classList.add("empty");
      notesList.innerHTML =
        '<p class="empty-text">No notes yet. Speak something and hit “Save as note”.</p>';
      updateNoteCount();
      return;
    }

    notesList.classList.remove("empty");
    notes.forEach((note, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "note-item";

      const textP = document.createElement("p");
      textP.className = "note-text";
      textP.textContent = note.text;

      const meta = document.createElement("div");
      meta.className = "note-meta";

      const dateSpan = document.createElement("span");
      dateSpan.textContent = note.createdAt;

      const actions = document.createElement("div");
      actions.className = "note-actions";

      const useBtn = document.createElement("button");
      useBtn.textContent = "Send to pad";
      useBtn.addEventListener("click", () => {
        // When user clicks "Send to pad", put this note into main textarea
        textOutput.value = note.text;
        finalText = note.text;

        // Visual feedback on the pad
        textOutput.classList.remove("pad-highlight");
        // Force reflow so animation can replay
        void textOutput.offsetWidth;
        textOutput.classList.add("pad-highlight");
        textOutput.focus();
      });

      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => {
        notes.splice(index, 1);
        renderNotes();
      });

      actions.appendChild(useBtn);
      actions.appendChild(delBtn);

      meta.appendChild(dateSpan);
      meta.appendChild(actions);

      wrapper.appendChild(textP);
      wrapper.appendChild(meta);

      notesList.appendChild(wrapper);
    });

    updateNoteCount();
  }

  function saveCurrentNote() {
    const text = textOutput.value.trim();
    if (!text) {
      errorArea.textContent = "Nothing to save. Speak or type something first.";
      return;
    }
    const now = new Date();
    const note = {
      text,
      createdAt: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    notes.unshift(note);
    renderNotes();
    errorArea.textContent = "Note saved ✔";
    setTimeout(() => (errorArea.textContent = ""), 1400);
  }

  // ---- event handlers ----
  function startListening() {
    if (!recognition || isListening) return;
    try {
      // keep whatever is already in the pad and continue from there
      finalText = smartFormat(textOutput.value.trim());
      recognition.start();
    } catch (e) {
      console.warn(e);
    }
  }

  function stopListening() {
    if (!recognition || !isListening) return;
    recognition.stop();
  }

  startBtn.addEventListener("click", startListening);
  stopBtn.addEventListener("click", stopListening);

  micButton.addEventListener("click", () => {
    if (isListening) stopListening();
    else startListening();
  });

  clearBtn.addEventListener("click", () => {
    resetTranscript();
  });

  saveNoteBtn.addEventListener("click", saveCurrentNote);

  // initial render
  renderNotes();
});
