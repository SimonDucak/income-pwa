const money = (cents) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100)
const amountText = (amount, type) => type === 'EUR'
  ? money(amount)
  : `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(amount / 100)}%`

// Monetary values and configured values are stored in hundredths (cents / basis points).
function calculate(income, expenses) {
  let remaining = income
  let fixed = 0
  let percentage = 0
  const rows = expenses.map((expense) => {
    let value = expense.amount
    if (expense.amount_type === 'PERCENT_INCOME') value = Math.round(income * expense.amount / 10000)
    if (expense.amount_type === 'PERCENT_REMAINING') value = remaining > 0 ? Math.round(remaining * expense.amount / 10000) : 0
    if (expense.amount_type === 'EUR') fixed += value
    else percentage += value
    remaining -= value
    return { ...expense, calculated: value, remaining }
  })
  return { rows, fixed, percentage, total: fixed + percentage, remaining }
}

function nextMonth(year, month) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}

const monthName = (year, month, style = 'long') => new Intl.DateTimeFormat('en', { month: style, year: 'numeric' }).format(new Date(year, month - 1, 1))
