if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js');
}

// 화면 생성
document.body.innerHTML = `
  <h2>JJ 과제 로그인</h2>

  <input id="id" placeholder="학번"><br><br>
  <input id="pw" type="password" placeholder="비밀번호"><br><br>

  <button onclick="login()">로그인</button>

  <p id="status">대기중</p>

  <div id="app"></div>
`;

async function login() {
  const id = document.getElementById("id").value;
  const pw = document.getElementById("pw").value;

  const url = `https://cyber.jj.ac.kr/login/token.php?username=${id}&password=${pw}&service=moodle_mobile_app`;

  document.getElementById("status").innerText = "로그인 중...";

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!data.token) {
      document.getElementById("status").innerText = "로그인 실패";
      return;
    }

    // 저장 (핵심)
    localStorage.setItem("moodle_token", data.token);

    document.getElementById("status").innerText = "로그인 성공";

    loadHome(data.token);

  } catch (e) {
    document.getElementById("status").innerText = "에러 발생";
  }
}

// 자동 로그인
window.onload = () => {
  const token = localStorage.getItem("moodle_token");
  if (token) {
    document.getElementById("status").innerText = "자동 로그인 중...";
    loadHome(token);
  }
};

function loadHome(token) {
  document.getElementById("app").innerHTML = `
    <h3>로그인 완료</h3>
    <p>토큰: ${token}</p>
  `;
}
