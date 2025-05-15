// public/script/script.js

/*---------------------*/
/* menu toggle         */
/*---------------------*/
const menu = document.querySelector('#menu-bar'),
      navbar = document.querySelector('.navbar');
menu.onclick = () => {
  menu.classList.toggle('fa-times');
  navbar.classList.toggle('active');
};

/*---------------------*/
/* helper fetch JSON   */
/*---------------------*/
async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (opts && !res.ok) throw new Error('Network error');
  return opts && opts.method !== 'GET' ? true : res.json();
}

/*---------------------*/
/* current user        */
/*---------------------*/
function getCurrentUser() {
  return localStorage.getItem('currentUser') || 'Guest';
}
function setCurrentUser(u) {
  localStorage.setItem('currentUser', u);
}

/*---------------------*/
/* render Home page    */
/*---------------------*/
async function renderHome() {
  const tests   = await fetchJSON('/api/tests'),
        history = await fetchJSON('/api/history'),
        user    = getCurrentUser(),
        list    = document.getElementById('test-list');
  list.innerHTML = '';
  tests.forEach(t => {
    const userHist = history.filter(h => h.user === user && h.testId === t.id);
    const last     = userHist.length
      ? `${userHist[userHist.length-1].score}/${t.questions.length}` : '—';
    const best     = userHist.length
      ? `${Math.max(...userHist.map(h => h.score))}/${t.questions.length}` : '—';
    let locked = false;
    if (t.prereq) {
      const preHist = history.filter(h => h.user === user && h.testId === t.prereq),
            preBest = preHist.length ? Math.max(...preHist.map(h => h.score)) : 0,
            preTest = tests.find(x => x.id === t.prereq);
      if (preBest < preTest.questions.length) locked = true;
    }
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `
      <div>
        <strong>${t.title}</strong> [${t.difficulty}]<br>
        Q: ${t.questions.length} | Last: ${last} | Best: ${best}<br>
        ${locked?'<em>Locked</em>':'<em>Available</em>'}
      </div>
      <div>
        <button class="btn" ${locked?'disabled':''}
          onclick="location='test.html?id=${t.id}'">
          Take Test
        </button>
      </div>`;
    list.appendChild(div);
  });
}

/*---------------------*/
/* render Story page   */
/*---------------------*/
async function renderStory() {
  const history = await fetchJSON('/api/history'),
        tbody   = document.getElementById('history-body');
  tbody.innerHTML = '';

  history.forEach(h => {
    const tr = document.createElement('tr');
    tr.dataset.id   = h.id;
    tr.dataset.date = h.date;
    tr.innerHTML = `
      <td>${h.user}</td>
      <td>${h.testTitle}</td>
      <td>${h.score}</td>
      <td>${new Date(h.date).toLocaleString()}</td>
      <td class="delete-cell">Delete</td>`;
    tbody.appendChild(tr);
  });

  attachStoryHandlers();
}

/*------------------------------*/
/* Story: delete & sort logic   */
/*------------------------------*/
function attachStoryHandlers() {
  const tbody     = document.getElementById('history-body'),
        deleteAll = document.getElementById('delete-all'),
        headers   = document.querySelectorAll('#historyTable thead th[data-col]');

  // індивідуальне видалення
  tbody.querySelectorAll('td.delete-cell').forEach(td => {
    td.addEventListener('click', async () => {
      const tr = td.parentElement;
      await fetchJSON(`/api/history/${tr.dataset.id}`, { method: 'DELETE' });
      tr.remove();
    });
  });

  // видалити все
  deleteAll.addEventListener('click', async () => {
    await fetchJSON('/api/history', { method: 'DELETE' });
    tbody.innerHTML = '';
  });

  // сортування з ▲/▼ та чергуванням напрямку
  headers.forEach(th => {
    th.dataset.dir = 1;
    th.addEventListener('click', () => {
      const col = th.dataset.col,
            dir = Number(th.dataset.dir);
      sortHistory(col, dir);
      document.querySelectorAll('.sort-indicator').forEach(sp => sp.textContent = '');
      th.querySelector('.sort-indicator').textContent = dir===1 ? '▲' : '▼';
      th.dataset.dir = -dir;
    });
  });
}

/*---------------------*/
/* sorting helper      */
/*---------------------*/
function sortHistory(col, dir) {
  const tbody = document.getElementById('history-body'),
        rows  = Array.from(tbody.querySelectorAll('tr'));

  rows.sort((a, b) => {
    let aVal, bVal;
    if (col==='date') {
      aVal = +a.dataset.date; bVal = +b.dataset.date;
    } else if (col==='score') {
      aVal = +a.cells[getColIdx(col)-1].innerText;
      bVal = +b.cells[getColIdx(col)-1].innerText;
    } else {
      aVal = a.cells[getColIdx(col)-1].innerText;
      bVal = b.cells[getColIdx(col)-1].innerText;
    }
    return aVal===bVal ? 0 : (aVal<bVal ? -dir : dir);
  });

  tbody.innerHTML = '';
  rows.forEach(r => tbody.appendChild(r));
}

/*---------------------*/
/* column index map    */
/*---------------------*/
function getColIdx(col) {
  switch(col) {
    case 'user':      return 1;
    case 'testTitle': return 2;
    case 'score':     return 3;
    case 'date':      return 4;
  }
}

/*---------------------*/
/* render Settings     */
/*---------------------*/
let editingTestId = null;
async function renderSettings() {
  const tests = await fetchJSON('/api/tests'),
        ul    = document.getElementById('settings-test-list'),
        form  = document.getElementById('add-test-form');
  ul.innerHTML = '';
  tests.forEach(t => {
    const li = document.createElement('li');
    li.className = 'list-item';
    li.innerHTML = `
      <span>${t.title} (${t.difficulty})</span>
      <div>
        <button onclick="startEdit(${t.id})">Edit</button>
        <button onclick="deleteTest(${t.id})">Delete</button>
      </div>`;
    ul.appendChild(li);
  });
  form.onsubmit = async e => {
    e.preventDefault();
    const t = {
      id: editingTestId,
      title: form.title.value,
      difficulty: form.difficulty.value,
      questions: JSON.parse(form.questions.value),
      prereq: +form.prereq.value || null
    };
    await fetchJSON(
      editingTestId ? `/api/tests/${editingTestId}` : '/api/tests',
      {
        method: editingTestId ? 'PUT' : 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(t)
      }
    );
    location.reload();
  };
}
async function deleteTest(id) {
  await fetchJSON(`/api/tests/${id}`,{method:'DELETE'});
  location.reload();
}
function startEdit(id) {
  editingTestId = id;
  fetchJSON('/api/tests').then(ts => {
    const t = ts.find(x=>x.id===id),
          form = document.getElementById('add-test-form');
    form.title.value      = t.title;
    form.difficulty.value = t.difficulty;
    form.questions.value  = JSON.stringify(t.questions, null,2);
    form.prereq.value     = t.prereq||'';
  });
}

/*---------------------*/
/* render Test page    */
/*---------------------*/
async function renderTest() {
  const params  = new URLSearchParams(location.search),
        id      = +params.get('id'),
        tests   = await fetchJSON('/api/tests'),
        test    = tests.find(t=>t.id===id),
        history = await fetchJSON('/api/history'),
        user    = getCurrentUser();
  document.getElementById('test-title').textContent = test.title;
  const container = document.getElementById('question-container');
  let idx=0, score=0, start=Date.now();

  function showQ(){
    const q = test.questions[idx];
    container.innerHTML = `
      <p>${q.question}</p>
      ${q.options.map((opt,i)=>`
        <div class="option" data-index="${i}">
          <input name="opt" type="radio" id="o${i}" value="${i}">
          <label for="o${i}">${opt}</label>
        </div>`).join('')}
      <button id="next-btn" class="btn">
        ${idx<test.questions.length-1?'Next':'Finish'}
      </button>`;
    // тепер клікабельна вся область варіанту
    container.querySelectorAll('.option').forEach(div => {
      div.onclick = () => {
        div.querySelector('input[name="opt"]').checked = true;
      };
    });
    document.getElementById('next-btn').onclick = ()=>{
      const sel = +container.querySelector('input[name="opt"]:checked')?.value;
      if(sel===q.answer) score++;
      idx++;
      idx<test.questions.length ? showQ() : finish();
    };
  }

  async function finish(){
    const time = Math.floor((Date.now()-start)/1000);
    document.getElementById('result-text').textContent =
      `Result: ${score}/${test.questions.length} — Time: ${time}s`;
    document.getElementById('result-modal').classList.add('active');
    await fetchJSON('/api/history',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({user,testId:test.id,testTitle:test.title,score,date:Date.now()})
    });
    document.getElementById('modal-close').onclick=()=>{
      document.getElementById('result-modal').classList.remove('active');
      location='index.html';
    };
  }

  showQ();
}

/*---------------------*/
/* render User page    */
/*---------------------*/
async function renderUser() {
  const users   = await fetchJSON('/api/users'),
        current = getCurrentUser(),
        ul      = document.getElementById('user-list');
  ul.innerHTML = '';
  users.forEach(u=>{
    const li=document.createElement('li');
    li.className='list-item';
    li.innerHTML=`
      <span${u===current?' style="font-weight:700"':''}>${u}</span>
      <div>
        <button onclick="switchUser('${u}')">Switch</button>
        <button onclick="deleteUser('${u}')">Delete</button>
      </div>`;
    ul.appendChild(li);
  });
  document.getElementById('add-user-form').onsubmit=async e=>{
    e.preventDefault();
    const name=e.target.username.value.trim();
    if(!name) return;
    await fetchJSON('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:name})});
    setCurrentUser(name);
    location.reload();
  };
}
async function deleteUser(u){
  if(u===getCurrentUser()) return alert('Cannot delete active user');
  await fetchJSON(`/api/users/${u}`,{method:'DELETE'});
  location.reload();
}
function switchUser(u){
  setCurrentUser(u);
  location.reload();
}

/*---------------------*/
/* initialize page     */
/*---------------------*/
document.addEventListener('DOMContentLoaded',()=>{
  if(document.getElementById('test-list'))            renderHome();
  if(document.getElementById('history-body'))         renderStory();
  if(document.getElementById('settings-test-list'))   renderSettings();
  if(document.getElementById('question-container'))   renderTest();
  if(document.getElementById('user-list'))            renderUser();
});
