export type ParsedRange = {
    from: string
    to: string
    startUtc: Date
    endUtc: Date
    days: string[]
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/

export function parseStatsDateRange(
    url: URL,
    timezone: string,
    now = new Date(),
): ParsedRange {
    const fallbackTo = formatDateInTimeZone(now, timezone)
    const fallbackFrom = addDays(fallbackTo, -29)
    const from = url.searchParams.get('from') ?? fallbackFrom
    const to = url.searchParams.get('to') ?? fallbackTo

    assertDate(from, 'from')
    assertDate(to, 'to')
    if (from > to) throw new Error('from must be before or equal to to')

    const days = eachDay(from, to)
    if (days.length > 366) throw new Error('range cannot exceed 366 days')

    return {
        from,
        to,
        startUtc: zonedDateStartUtc(from, timezone),
        endUtc: zonedDateStartUtc(addDays(to, 1), timezone),
        days,
    }
}

export function formatDateInTimeZone(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        day: '2-digit',
        month: '2-digit',
        timeZone: timezone,
        year: 'numeric',
    }).formatToParts(date)
    return `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`
}

export function zonedDateStartUtc(date: string, timezone: string) {
    const [year, month, day] = date.split('-').map(Number)
    const utcGuess = Date.UTC(year!, month! - 1, day!, 0, 0, 0)
    const offset = readTimeZoneOffsetMs(new Date(utcGuess), timezone)
    return new Date(utcGuess - offset)
}

export function addDays(date: string, amount: number) {
    const [year, month, day] = date.split('-').map(Number)
    const next = new Date(Date.UTC(year!, month! - 1, day! + amount))
    return next.toISOString().slice(0, 10)
}

function eachDay(from: string, to: string) {
    const days: string[] = []
    for (let day = from; day <= to; day = addDays(day, 1)) days.push(day)
    return days
}

function assertDate(value: string, name: string) {
    if (!datePattern.test(value) || Number.isNaN(Date.parse(`${value}T00:00Z`)))
        throw new Error(`invalid ${name} date`)
}

function readTimeZoneOffsetMs(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
        minute: '2-digit',
        month: '2-digit',
        second: '2-digit',
        timeZone: timezone,
        year: 'numeric',
    }).formatToParts(date)
    const asUtc = Date.UTC(
        Number(part(parts, 'year')),
        Number(part(parts, 'month')) - 1,
        Number(part(parts, 'day')),
        Number(part(parts, 'hour')) % 24,
        Number(part(parts, 'minute')),
        Number(part(parts, 'second')),
    )
    return asUtc - date.getTime()
}

function part(parts: Intl.DateTimeFormatPart[], type: string) {
    const value = parts.find((item) => item.type === type)?.value
    if (!value) throw new Error(`missing ${type}`)
    return value
}
