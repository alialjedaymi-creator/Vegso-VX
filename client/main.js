const API_BASE = '/api';

async function api(path, opts = {}){
  const res = await fetch(API_BASE + path, opts);
  if (!res.ok) throw new Error('API error ' + res.status);
  return res.json();
}

async function loadHealth(){
  try{
    const h = await api('/health');
    document.getElementById('health').textContent = `متصل — ${h.time}`;
  }catch(e){
    document.getElementById('health').textContent = 'غير متاح (تأكد من تشغيل الخادم)';
  }
}

async function loadInventory(){
  const list = document.getElementById('inventory-list');
  list.innerHTML = '';
  try{
    // For demo we try unauthenticated; server requires auth, so indicate instructions
    const items = await api('/inventory');
    items.forEach(it => {
      const li = document.createElement('li');
      li.textContent = `${it.name} — كمية: ${it.quantity} — موقع: ${it.location || '-'} `;
      list.appendChild(li);
    });
  }catch(e){
    const li = document.createElement('li');
    li.textContent = 'تحتاج لتسجيل الدخول عبر API قبل عرض المخزون. (انظر README)';
    list.appendChild(li);
  }
}

document.getElementById('add-item-form').addEventListener('submit', async (ev) =>{
  ev.preventDefault();
  const f = ev.target;
  const data = { sku: f.sku.value, name: f.name.value, quantity: Number(f.quantity.value || 0) };
  try{
    await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer <token>' }, body: JSON.stringify(data)});
    alert('تم الإرسال؛ استخدم واجهة مصادقة للحصول على التوكن عملياً');
    f.reset();
    loadInventory();
  }catch(err){
    alert('فشل الإضافة: تحتاج لتشغيل الخادم و/أو المصادقة (انظر README)');
  }
});

loadHealth();
loadInventory();
