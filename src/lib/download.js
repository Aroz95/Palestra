// Scarica un contenuto come file
export function downloadText(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadJSON(filename, data) {
  downloadText(filename, JSON.stringify(data, null, 2))
}

export function downloadCSV(filename, csv) {
  // BOM per una corretta apertura in Excel
  downloadText(filename, `﻿${csv}`, 'text/csv;charset=utf-8')
}
