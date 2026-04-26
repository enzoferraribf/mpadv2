import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
import { readDatabaseUrl } from '#/platform/env'

let sqlInstance: SQL | null = null

function getSql() {
    sqlInstance ??= new SQL(readDatabaseUrl())
    return sqlInstance
}

export const sql = new Proxy((() => {}) as unknown as SQL, {
    apply(_target, thisArg, args) {
        return Reflect.apply(getSql(), thisArg, args)
    },
    get(_target, property) {
        const value = Reflect.get(getSql(), property)
        return typeof value === 'function' ? value.bind(getSql()) : value
    },
}) as SQL

export const db = drizzle({ client: sql })
