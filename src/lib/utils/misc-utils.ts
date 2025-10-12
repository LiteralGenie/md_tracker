import { range, sleep, sum, zip } from "radash"
import { InferGuardType, ISODate, Or } from "./type-utils"

export function split<T, TPass extends T = T, TFail extends T = T>(
    xs: T[],
    condition: (x: T) => boolean
): [TPass[], TFail[]] {
    const pass = [] as TPass[]
    const fail = [] as TFail[]

    for (let x of xs) {
        if (condition(x)) {
            pass.push(x as TPass)
        } else {
            fail.push(x as TFail)
        }
    }

    return [pass, fail]
}

export function splitMap<T, TPass = T, TFail = T>(
    xs: T[],
    fn: (
        x: T
    ) =>
        | { type: "pass"; value: TPass }
        | { type: "fail"; value: TFail }
): [TPass[], TFail[]] {
    const pass = [] as TPass[]
    const fail = [] as TFail[]

    for (let x of xs) {
        const mapped = fn(x)

        if (mapped.type === "pass") {
            pass.push(mapped.value)
        } else {
            fail.push(mapped.value)
        }
    }

    return [pass, fail]
}

export interface SleepUntilOpts {
    check: () => boolean
    tries?: number
    delay?: number
}

/** Defaults to 60 tries @ 50ms = 3s retry period */
export async function sleepUntil(opts: SleepUntilOpts) {
    const n = opts?.tries ?? 60
    for (let _ of range(n - 1)) {
        const value = opts.check()
        if (value) {
            return true
        }

        await sleep(opts.delay ?? 50)
    }

    return false
}

export function uuidWithFallback() {
    let randomUUID
    if (window?.crypto?.randomUUID !== undefined) {
        randomUUID = () => window.crypto.randomUUID()
    } else {
        const now = new Date().toISOString()
        const n = Math.random().toString()
        randomUUID = () => `${now}_${n}`
    }

    return randomUUID()
}

export function findNext<
    TItem,
    TCond extends (x: TItem, idx: number) => boolean = (
        x: TItem
    ) => boolean
>(
    xs: TItem[],
    cond: TCond,
    opts: {
        reverse?: boolean
        start?: number
        end?: number
        breakOn?: (x: TItem) => boolean
    } = {}
): [Or<InferGuardType<TCond>, TItem>, number] | [null, null] {
    const reverse = opts.reverse ?? false

    let start, end, step
    if (reverse) {
        start = opts.start ?? xs.length - 1
        end = opts.end ?? 0
        step = -1
    } else {
        start = opts.start ?? 0
        end = opts.end ?? xs.length - 1
        step = 1
    }

    for (
        let idx = start;
        reverse ? idx >= end : idx <= end;
        idx += step
    ) {
        const x = xs[idx]

        if (cond(x, idx)) {
            return [x as any, idx]
        } else if (opts?.breakOn?.(x)) {
            return [null, null]
        }
    }

    return [null, null]
}

export function enumerate<T>(xs: T[]): Array<[number, T]> {
    return xs.map((x, idx) => [idx, x])
}

export interface SortByCriteria<TItem = any> {
    fn: (x: TItem) => number | string
    reverse?: boolean
}
export function sortBy<TItem = any>(
    xs: TItem[],
    criteria: SortByCriteria<TItem>[]
): TItem[] {
    const mapped = xs.map((x) => ({
        x,
        value: criteria.map((crit) => crit.fn(x)),
    }))

    const sorted = mapped.sort((a, b) => {
        for (const [aa, bb, crit] of zip(
            a.value,
            b.value,
            criteria
        )) {
            // prettier-ignore
            const diff =
                aa < bb ? -1 :
                aa > bb ? 1 :
                0
            if (diff === 0) {
                continue
            }

            const mult = crit.reverse ? -1 : 1
            return diff * mult
        }

        return 0
    })

    return sorted.map((x) => x.x)
}

export function formatNumber(x: number, alwaysShowSign?: boolean) {
    // prettier-ignore
    const sgn =
        x < 0 ? "-" :
        alwaysShowSign ? "+" :
        ""

    const digits = [...Math.trunc(Math.abs(x)).toString()]
        .reverse()
        .reduce((acc, digit, idx) => {
            if (idx % 3 === 0 && idx > 0) {
                acc.push(",")
            }

            acc.push(digit)

            return acc
        }, [] as string[])

    return sgn + digits.reverse().join("")
}

export function takeWhile<
    TItem,
    TCond extends (x: TItem, idx: number) => boolean = (
        x: TItem
    ) => boolean
>(
    xs: TItem[],
    cond: TCond,
    opts: {
        reverse?: boolean
        start?: number
        end?: number
    } = {}
): Array<Or<InferGuardType<TCond>, TItem>> {
    const reverse = opts.reverse ?? false

    let start, end, step
    if (reverse) {
        start = opts.start ?? xs.length - 1
        end = opts.end ?? 0
        step = -1
    } else {
        start = opts.start ?? 0
        end = opts.end ?? xs.length - 1
        step = 1
    }

    const items: any[] = []

    for (
        let idx = start;
        reverse ? idx >= end : idx <= end;
        idx += step
    ) {
        const x = xs[idx]

        if (cond(x, idx)) {
            items.push(x)
        } else {
            break
        }
    }

    return items
}

export function setDefault<
    TKey extends string | number | symbol,
    TRecord extends Record<TKey, any>
>(record: TRecord, key: TKey, value: TRecord[TKey]): TRecord[TKey] {
    record[key] = record[key] ?? value
    return record[key]
}

export function avg(xs: number[]) {
    if (xs.length === 0) {
        return 0
    }

    return sum(xs) / xs.length
}

export function indexes(xs: any[]): number[] {
    return [...range(xs.length - 1)]
}

export async function compressGzip(
    text: string
): Promise<Array<Uint8Array>> {
    const asBytes = new TextEncoder().encode(text)
    const asStream = new ReadableStream({
        start(controller) {
            controller.enqueue(asBytes)
            controller.close()
        },
    })
        .pipeThrough(new CompressionStream("gzip"))
        .getReader()

    const asCompressed: Array<Uint8Array> = []
    while (true) {
        const { done, value } = (await asStream.read()) as {
            done: boolean
            value: Uint8Array
        }

        if (done) {
            break
        } else {
            asCompressed.push(value)
        }
    }

    return asCompressed
}

export async function decompressGzip(
    data: Array<Uint8Array> | Array<ArrayBuffer>
): Promise<string> {
    const asStream = new ReadableStream({
        start(controller) {
            for (const arr of data) {
                controller.enqueue(arr)
            }
            controller.close()
        },
    })
        .pipeThrough(new DecompressionStream("gzip"))
        .getReader()

    let parts: string[] = []
    const decoder = new TextDecoder()
    while (true) {
        const { done, value } = (await asStream.read()) as {
            done: boolean
            value: Uint8Array
        }
        if (done) {
            break
        } else {
            parts.push(decoder.decode(value, { stream: true }))
        }
    }

    parts.push(decoder.decode())
    return parts.join("")
}

export async function consumeAsync<T = any>(
    iter: AsyncGenerator<T>
): Promise<T[]> {
    const result: T[] = []
    for await (const x of iter) {
        result.push(x)
    }
    return result
}

export function concatArrays(xs: Uint8Array[]) {
    const totalSize = sum(xs, (x) => x.length)
    const total = new Uint8Array(totalSize)

    let start = 0
    for (const arr of xs) {
        total.set(arr, start)
        start += arr.length
    }

    return total
}

export function assert(cond: boolean, msg?: string) {
    if (!cond) {
        throw new Error(msg)
    }
}

export function query<T extends Element | HTMLElement>(
    root: Element | HTMLElement | Document | ShadowRoot,
    selector: string
): T | null {
    return root.querySelector(selector) as T | null
}

export function queryAll<T extends Element | HTMLElement>(
    root: Element | HTMLElement | Document | ShadowRoot,
    selector: string
): T[] {
    return [...root.querySelectorAll(selector)] as T[]
}

export async function postJson<T = any>(
    url: string,
    body: Record<string, any>,
    opts?: RequestInit
): Promise<T> {
    const resp = await fetch(url, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...opts?.headers,
        },
        body: JSON.stringify(body),
        ...opts,
    })

    if (resp.status < 200 || resp.status >= 300) {
        const e = new Error(`${resp.status} ${resp.statusText}`)
        e.cause = {
            type: "postJson",
            response: resp,
        }
        throw e
    }

    return await resp.json()
}

export async function getJson<T = any>(
    url: string,
    opts?: RequestInit
): Promise<T> {
    const resp = await fetch(url, {
        ...opts,
    })

    if (resp.status < 200 || resp.status >= 300) {
        const e = new Error()
        e.cause = {
            type: "postJson",
            response: resp,
        }
        throw e
    }

    return await resp.json()
}

export function nowIso(): ISODate {
    return new Date().toISOString()
}

export type Fn<TArgs extends Array<any>, TReturn> = (
    ...args: TArgs
) => TReturn

export interface ThrottleUntilSettledOpts<
    TArgs extends Array<any>,
    TReturn
> {
    fn: Fn<TArgs, TReturn>
    interval: number
}

export function debounceUntilSettled<
    TArgs extends Array<any>,
    TReturn
>(opts: ThrottleUntilSettledOpts<TArgs, TReturn>): Fn<TArgs, void> {
    let lastCallTime = 0
    let pendingCallId = 0

    const wrapper: Fn<TArgs, void> = (...args) => {
        clearTimeout(pendingCallId)

        const now = Date.now()
        const elapsed = now - lastCallTime
        const remDelay = opts.interval - elapsed
        if (remDelay <= 0) {
            console.log("call now", remDelay, lastCallTime, now)
            opts.fn(...args)
            lastCallTime = now
        } else {
            console.log("call later", remDelay, lastCallTime, now)
            pendingCallId = window.setTimeout(() => {
                console.log("call later now", remDelay)
                opts.fn(...args)
            }, remDelay)
        }
    }

    return wrapper
}
