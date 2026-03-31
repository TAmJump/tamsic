
let allNews = [];

async function loadNews() {
  allNews = await TAMSICDB.getNews();
  renderNews('all');
}

function renderNews(filter) {
  const list = document.getElementById('news-list');
  const items = filter==='all' ? allNews : allNews.filter(n=>n.tag===filter);
  if (!items.length) {
    list.innerHTML = '<div class="no-news"><p>まだニュースはありません。</p></div>';
    return;
  }
  list.innerHTML = items.map(n=>`
    <div class="news-item" data-tag="${n.tag}">
      <span class="ni-date">${n.date||'—'}</span>
      <div class="ni-body">
        <p class="ni-title">${n.title}</p>
        ${n.titleEn?`<p class="ni-sub">${n.titleEn}</p>`:''}
      </div>
      <span class="ni-tag">${n.tag||'Info'}</span>
    </div>`).join('');
}

function filterNews(tag, btn) {
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderNews(tag);
}

loadNews();
