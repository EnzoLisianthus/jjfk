// =========================
// CONFIG
// =========================
window.addEventListener("DOMContentLoaded", () => {
  App.init();
});
const BASE_URL = "https://cyber.jj.ac.kr/webservice/rest/server.php";
const TOKEN_URL = "https://cyber.jj.ac.kr/login/token.php";

// =========================
// STATE (핵심 추가)
// =========================
const State = {
  token: null,
  data: [],
  interval: null
};

// =========================
// STORE
// =========================
const Store = {
  get(key) {
    return JSON.parse(localStorage.getItem(key));
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key) {
    localStorage.removeItem(key);
  }
};

// =========================
// AUTH
// =========================
const Auth = {
  getToken() {
    return Store.get("token");
  },

  async login(username, password) {
    const url = `${TOKEN_URL}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&service=moodle_mobile_app`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.token) {
      Store.set("token", data.token);
      State.token = data.token;
      return data.token;
    }

    throw new Error("로그인 실패");
  },

  logout() {
    Store.remove("token");
    State.token = null;

    if (State.interval) clearInterval(State.interval);

    App.showLogin();
  }
};

// =========================
// API
// =========================
const API = {
  async fetchAssignments(token) {
    const url = `${BASE_URL}?moodlewsrestformat=json&wsfunction=mod_assign_get_assignments&wstoken=${token}`;
    const res = await fetch(url);
    return await res.json();
  }
};

// =========================
// DATA
// =========================
const Data = {
  normalize(raw) {
    const result = [];

    raw.courses.forEach(course => {
      if (!course.assignments?.length) return;

      result.push({
        courseName: course.fullname,
        assignments: course.assignments.map(a => ({
          id: a.id,
          title: a.name,
          deadline: a.duedate * 1000
        }))
      });
    });

    return result;
  },

  sort(data) {
    data.forEach(c => {
      c.assignments.sort((a, b) => a.deadline - b.deadline);
    });
    return data;
  }
};

// =========================
// LOGIC
// =========================
const Logic = {
  calcStatus(deadline) {
    const now = Date.now();
    const diff = deadline - now;

    if (diff < 0) {
      return {
        color: "gray",
        text: this.formatPassed(-diff)
      };
    }

    const days = diff / 86400000;

    if (days < 3) {
      return {
        color: "orange",
        text: this.formatRemain(diff)
      };
    }

    return {
      color: "green",
      text: this.formatRemain(diff)
    };
  },

  formatRemain(ms) {
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${d}일 ${h}시간 ${m}분 남음`;
  },

  formatPassed(ms) {
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `마감 ${d}일 ${h}시간 ${m}분 경과`;
  }
};

// =========================
// UI (LAYER SYSTEM 기반)
// =========================
const UI = {
  loginLayer: document.getElementById("login-layer"),
  dashboardLayer: document.getElementById("dashboard-layer"),
  content: document.getElementById("content"),

  show(layer) {
    document.querySelectorAll(".layer").forEach(l => l.classList.remove("active"));
    layer.classList.add("active");
  },

  renderLogin() {
    this.show(this.loginLayer);

    this.loginLayer.innerHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <div class="title">로그인</div>

          <input id="id" placeholder="학번" />
          <input id="pw" type="password" placeholder="비밀번호" />

          <button id="loginBtn">로그인</button>
        </div>
      </div>
    `;

    document.getElementById("loginBtn").onclick = async () => {
      const id = document.getElementById("id").value;
      const pw = document.getElementById("pw").value;

      try {
        await Auth.login(id, pw);
        App.init();
      } catch {
        alert("로그인 실패");
      }
    };
  },

  renderDashboard(data) {
    const view = document.getElementById("app-view");

    if (!view) {
      console.error("❌ app-view not found");
      return;
    }

    this.show(this.dashboardLayer);

    let html = "";

    data.forEach(course => {
      html += `<div class="course">${course.courseName}</div>`;

      course.assignments.forEach(a => {
        const s = Logic.calcStatus(a.deadline);

        html += `
          <div class="assignment-card">
            <div class="title">${a.title}</div>
            <div class="deadline">${new Date(a.deadline).toLocaleString()}</div>
            <div class="status ${s.color}">${s.text}</div>
          </div>
        `;
      });
    });

    view.innerHTML = html;
  }
};

// =========================
// NOTIFY
// =========================
const Notify = {
  async request() {
    if (Notification.permission !== "granted") {
      await Notification.requestPermission();
    }
  },

  check(data) {
    data.forEach(c => {
      c.assignments.forEach(a => {
        const diff = a.deadline - Date.now();

        if (diff > 0 && diff < 3600000) {
          this.send(`⏰ 1시간 남음: ${a.title}`);
        }
      });
    });
  },

  send(msg) {
    if (Notification.permission === "granted") {
      new Notification(msg);
    }
  }
};

// =========================
// APP CONTROLLER
// =========================
const App = {
  async init() {
    const token = Auth.getToken();
    State.token = token;

    if (!token) {
      UI.renderLogin();
      return;
    }

    await this.load();
    this.startAutoRefresh();
  },

  async load() {
    const raw = await API.fetchAssignments(State.token);

    let data = Data.normalize(raw);
    data = Data.sort(data);

    State.data = data;

    UI.renderDashboard(data);

    await Notify.request();
    Notify.check(data);
  },

  startAutoRefresh() {
    if (State.interval) clearInterval(State.interval);

    State.interval = setInterval(() => {
      this.load();
    }, 60000);
  },

  showLogin() {
    UI.renderLogin();
  }
};

// =========================
// START
// =========================
