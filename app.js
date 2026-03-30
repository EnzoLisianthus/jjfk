// =========================
// CONFIG
// =========================
const BASE_URL = "https://cyber.jj.ac.kr/webservice/rest/server.php";
const TOKEN_URL = "https://cyber.jj.ac.kr/login/token.php";

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
      return data.token;
    } else {
      throw new Error("로그인 실패");
    }
  },

  logout() {
    Store.remove("token");
    location.reload();
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
      if (!course.assignments || course.assignments.length === 0) return;

      const assignments = course.assignments.map(a => ({
        id: a.id,
        title: a.name,
        deadline: a.duedate * 1000,
        submitted: false // 현재 API 한계
      }));

      result.push({
        courseName: course.fullname,
        assignments
      });
    });

    return result;
  },

  sort(data) {
    data.forEach(course => {
      course.assignments.sort((a, b) => a.deadline - b.deadline);
    });
    return data;
  }
};

// =========================
// LOGIC
// =========================
const Logic = {
  calcStatus(deadline, submitted) {
    const now = Date.now();
    const diff = deadline - now;

    if (diff < 0) {
      return {
        status: "OVERDUE",
        color: "gray",
        text: this.formatPassed(-diff)
      };
    }

    const days = diff / 86400000;

    if (days < 3) {
      return {
        status: "DUE",
        color: "orange",
        text: this.formatRemain(diff)
      };
    }

    return {
      status: "SAFE",
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
    return `마감 후 ${d}일 ${h}시간 ${m}분 경과`;
  }
};

// =========================
// UI
// =========================
const UI = {
  renderLogin() {
    document.body.innerHTML = `
      <div style="padding:20px;">
        <h2>로그인</h2>
        <input id="id" placeholder="학번"><br><br>
        <input id="pw" type="password" placeholder="비밀번호"><br><br>
        <button id="loginBtn">로그인</button>
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

  render(data) {
    let html = `<div class="container"><h2>📚 과제 현황</h2>`;

    data.forEach(course => {
      html += `<div class="card"><div class="course">${course.courseName}</div>`;

      course.assignments.forEach(a => {
        const s = Logic.calcStatus(a.deadline, a.submitted);

        html += `
          <div class="assignment">
            <div class="title">${a.title}</div>
            <div class="deadline">마감: ${new Date(a.deadline).toLocaleString()}</div>
            <div class="status ${s.color}">${s.text}</div>
            <div class="submitted ${a.submitted ? "blue" : "red"}">
              ${a.submitted ? "제출 완료" : "미제출"}
            </div>
          </div>
        `;
      });

      html += `</div>`;
    });

    html += `</div>`;
    document.body.innerHTML = html;
  }
};

// =========================
// NOTIFY
// =========================
const Notify = {
  async requestPermission() {
    if (Notification.permission !== "granted") {
      await Notification.requestPermission();
    }
  },

  check(data) {
    data.forEach(course => {
      course.assignments.forEach(a => {
        const diff = a.deadline - Date.now();

        if (!a.submitted && diff > 0 && diff < 3600000) {
          this.send(`1시간 이하: ${a.title}`);
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
// APP
// =========================
const App = {
  async init() {
    const token = Auth.getToken();

    if (!token) {
      UI.renderLogin();
      return;
    }

    try {
      const raw = await API.fetchAssignments(token);

      let data = Data.normalize(raw);
      data = Data.sort(data);

      UI.render(data);

      await Notify.requestPermission();
      Notify.check(data);

      // 자동 갱신 (1분)
      setInterval(async () => {
        const raw = await API.fetchAssignments(token);
        let data = Data.normalize(raw);
        data = Data.sort(data);

        UI.render(data);
        Notify.check(data);
      }, 60000);

    } catch (e) {
      console.error(e);
      Auth.logout();
    }
  }
};

// =========================
// START
// =========================
window.onload = () => {
  App.init();
};
