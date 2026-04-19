import { SQL } from 'bun'
import { readDatabaseUrl } from './env'

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
        return typeof value === 'function'
            ? value.bind(getSql())
            : value
    },
}) as SQL
