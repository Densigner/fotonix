function renderTemplate(tpl, vars = {}) {
  if (!tpl) return '';
  return tpl.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
    const val = key.split('.').reduce((a,k)=> (a && a[k] != null ? a[k] : ''), vars);
    return (val ?? '').toString();
  });
}
module.exports = { renderTemplate };