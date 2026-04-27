(function () {
  if (window.__BUDDY_WIDGET_LOADED__) return;
  window.__BUDDY_WIDGET_LOADED__ = true;

  /* ================= CONFIG ================= */
  const BASE_URL = "https://mijnflaskapp.eu.ngrok.io";
  //const BASE_URL = "http://127.0.0.1:5000";
//  const API_ENDPOINT = BASE_URL + "/api/chat";
  const API_ENDPOINT = BASE_URL + "/v6/selectbuddy";  // DIT IS VERANDERD
  //const TRAINING_URL = top.location.href;
  const TRAINING_URL = "https://www2.the-academy.nl/trainingen/microsoft/microsoft365/ms-700-managing-microsoft-teams";


  const INACTIVITY_LIMIT = 45_000;
  const MAX_AUTO_INTERACTIONS = 3;

  /* ================= ASSETS (BELANGRIJK) ================= */
  const scriptUrl = new URL(document.currentScript.src);
  const ASSET_BASE =
    scriptUrl.href.substring(0, scriptUrl.href.lastIndexOf("/") + 1);

  const BUDDY_IMG = new URL("buddy.png", ASSET_BASE).href;
  const ACADEMY_IMG = new URL("academy.png", ASSET_BASE).href;

  /* ================= STORAGE ================= */
  const VISITOR_KEY = "__buddy_visitor_id__";
  const CONVO_KEY = "__buddy_conversation__";

  const visitor_id =
    sessionStorage.getItem(VISITOR_KEY) || crypto.randomUUID();
  sessionStorage.setItem(VISITOR_KEY, visitor_id);

  let conversation = JSON.parse(
    sessionStorage.getItem(CONVO_KEY) || "[]"
  );

  function saveConversation() {
    sessionStorage.setItem(CONVO_KEY, JSON.stringify(conversation));
  }

  /* ================= STATE ================= */
  let inactivityTimer = null;
  let isStreaming = false;
  let autoInteractionCount = 0;
  let lastScrollEvent = 0;

  /* ================= HELPERS ================= */
  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      if (!isStreaming) {
        callBuddy({ eventType: "silence" });
      }
    }, INACTIVITY_LIMIT);
  }

  function throttleScrollEvent() {
    const now = Date.now();
    if (now - lastScrollEvent < 5000) return false;
    lastScrollEvent = now;
    return true;
  }

  /* ================= STYLES ================= */
  const style = document.createElement("style");
  style.textContent = `
  *{
  font-family:verdana;
  }
#buddy-widget {
 
  position: fixed;
  bottom: 90px;
  right: 24px;
  width: 420px;
  height: 600px;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0,0,0,.2);
  z-index: 999999;
}

#buddy-header {
  height: 100px;
  padding-left: 180px;
  background: #2E2A66;
  border-radius: 16px 16px 0 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 20px;
}

.buddy-avatar {
  width: 160px;
  height: 140px;
  border-radius: 50%;
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
  box-shadow: 0 4px 12px rgba(0,0,0,.2);
}

.academy-logo {
  height: 26px;
}

.buddy-subtitle {
  color: #fff;
  font-size: 16px;
}

#buddy-close {
  background: transparent;
  border: none;
  font-size: 24px;
  color: #4ade80;
  cursor: pointer;
}

#buddy-messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: #f8f9fa;
}

.buddy-msg {
  margin-bottom: 12px;
  padding: 14px 18px;
  max-width: 75%;
  border-radius: 18px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.buddy-assistant {
  background: #dfe8f3;
  margin-right: auto;
}

.buddy-user {
  background: #e8e8e8;
  margin-left: auto;
  text-align: right;
}

#buddy-input {
  padding: 16px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  gap: 10px;
}

#buddy-input textarea {
  flex: 1;
  resize: none;
  border-radius: 14px;
  padding: 14px;
}

#buddy-send {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
}
#buddy-send:hover {
  background: #4f46e5;
}
`;
  document.head.appendChild(style);

  /* ================= HTML ================= */


  const widget = document.createElement("div");
  widget.id = "buddy-widget";
  widget.innerHTML = `
<div id="buddy-header">
  <img src="${BUDDY_IMG}" class="buddy-avatar" />
  <div>
    <img src="${ACADEMY_IMG}" class="academy-logo" />
    <div class="buddy-subtitle">SelectBuddy</div>
  </div>
  <button id="buddy-close">x</button>
</div>
<div id="buddy-messages"></div>
<div id="buddy-input">
  <textarea autofocus></textarea>
  <button id="buddy-send">></button>
</div>
`;

  document.body.appendChild(widget);

  const messagesEl = widget.querySelector("#buddy-messages");
  const textarea = widget.querySelector("textarea");
  const sendBtn = widget.querySelector("#buddy-send");
  const closeBtn = widget.querySelector("#buddy-close");



  closeBtn.onclick = () => {
    widget.style.display = "none";
  };

  function addMessage(role, text) {
    const div = document.createElement("div");
    div.className = `buddy-msg buddy-${role}`;
    div.innerHTML = text;
    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  /* ================= RESTORE MEMORY ================= */
  conversation.forEach((msg) => addMessage(msg.role, msg.content));

  /* ================= CORE ================= */
  async function callBuddy({ eventType, messageText = "", eventData = {} }) {
    if (isStreaming) return;

    const trimmed = messageText.trim();
    const isUser = Boolean(trimmed);

    if (!isUser && autoInteractionCount >= MAX_AUTO_INTERACTIONS) return;

    if (isUser) {
      conversation.push({ role: "user", content: trimmed });
      saveConversation();
      addMessage("user", trimmed);
      textarea.value = "";
    }

    isStreaming = true;

    try {
      const res = await fetch(API_ENDPOINT+"/chat", {   // DIT IS VERANDERD
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitor_id,
          url: TRAINING_URL,
          message: trimmed,
          event: { type: eventType, data: eventData },
          history: conversation,
        }),
      });
      console.log(res.body);
      if (res.status === 204) {  // DIT IS VERANDERD
        return;                   // DIT IS VERANDERD
      }                           // DIT IS VERANDERD
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      const bubble = addMessage("assistant", "");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        console.log(value)
        assistantText += decoder.decode(value, { stream: true });
        bubble.textContent = assistantText;
        scrollToBottom();
      }

      assistantText += decoder.decode();
      bubble.innerHTML = assistantText;
      scrollToBottom();

      conversation.push({
        role: "assistant",
        content: assistantText.trim(),
      });
      saveConversation();

      if (!isUser) autoInteractionCount++;
    } catch {
      addMessage("assistant", "Er ging iets mis.");
    } finally {
      isStreaming = false;
      resetInactivityTimer();
    }
    try {
      fetch(API_ENDPOINT+"/verwerk_data", { // DIT IS VERANDERD
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitor_id,
          url: TRAINING_URL,
          message: trimmed,
          event: { type: eventType, data: eventData },
          history: conversation,
        }),
      });
    }
    catch{
      console.log("tweede call fout gegaan")
    }
    console.log("klaar")
  }

  /* ================= INPUT ================= */
  sendBtn.onclick = () => {
    if (textarea.value.trim()) {
      callBuddy({
        eventType: "user_message",
        messageText: textarea.value,
      });
    }
  };

  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  /* ================= EVENTS ================= */
  window.addEventListener("scroll", () => {
    if (throttleScrollEvent()) {
      callBuddy({ eventType: "scroll" });
    }
    resetInactivityTimer();
  });

  document.addEventListener("visibilitychange", () => {
    callBuddy({
      eventType: "navigation",
      eventData: { state: document.hidden ? "hidden" : "visible" },
    });
  });

  window.addEventListener("load", () => {
    widget.style.display = "flex";
    resetInactivityTimer();
    callBuddy({ eventType: "page_load" });
  });
})();
