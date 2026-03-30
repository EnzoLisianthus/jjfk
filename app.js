async function loadTasks() {
  // 서버 대신 "파일 기반 API"라고 가정
  const res = await fetch("./tasks.json");
  const data = await res.json();

  const app = document.getElementById("app");
  app.innerHTML = "";

  data.forEach(task => {
    const div = document.createElement("div");
    div.innerHTML = `<b>${task.title}</b> - ${task.id}`;
    app.appendChild(div);
  });
}

loadTasks();
