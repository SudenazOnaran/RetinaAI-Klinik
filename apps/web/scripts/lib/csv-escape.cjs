/** @param {unknown} val */
function csvEscape(val) {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (/[\r\n",]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

module.exports = { csvEscape };
