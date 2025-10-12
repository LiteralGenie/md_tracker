import { BehaviorSubject } from "@/lib/rx/behavior-subject"
import { sleep } from "radash"
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from "vitest"

describe("signal", () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    test("subscribe() should work", () => {
        const bs = new BehaviorSubject(1)

        const vals = [] as number[]
        bs.subscribe((x) => {
            vals.push(x)
        })

        bs.set(2)
        bs.set(3)

        expect(vals).toEqual([1, 2, 3])
    })

    test("unsubscribe() should work", () => {
        const bs = new BehaviorSubject(1)

        const id = Symbol()
        const vals = [] as number[]

        bs.subscribe((x) => vals.push(x), id)
        expect(vals).toEqual([1])

        bs.set(2)
        expect(vals).toEqual([1, 2])

        bs.unsubscribe(id)
        bs.set(3)
        expect(vals).toEqual([1, 2])

        bs.unsubscribe(id)
        bs.set(4)
        expect(vals).toEqual([1, 2])
    })

    test("unsub callback returned by subscribe() should work", () => {
        const bs = new BehaviorSubject(1)

        const id = Symbol()
        const vals = [] as number[]

        const sub = bs.subscribe((x) => vals.push(x), id)
        expect(vals).toEqual([1])

        bs.set(2)
        expect(vals).toEqual([1, 2])

        sub.unsubscribe()
        bs.set(3)
        expect(vals).toEqual([1, 2])

        sub.unsubscribe()
        bs.set(4)
        expect(vals).toEqual([1, 2])
    })

    test("pipe() should work", () => {
        const bs = new BehaviorSubject(1)

        const id = Symbol()
        const vals = [] as number[]

        const sub = bs.subscribe((x) => vals.push(x), id)
        expect(vals).toEqual([1])

        bs.set(2)
        expect(vals).toEqual([1, 2])

        sub.unsubscribe()
        bs.set(3)
        expect(vals).toEqual([1, 2])

        sub.unsubscribe()
        bs.set(4)
        expect(vals).toEqual([1, 2])
    })

    test("subscribeAsync() should work", async () => {
        const bs = new BehaviorSubject(3)

        const vals = [] as number[]
        bs.subscribeAsync(async (x) => {
            await sleep(x * 50)
            vals.push(x)
        })

        bs.set(2)
        bs.set(1)

        expect(vals).toEqual([])

        await vi.runOnlyPendingTimersAsync()
        expect(vals).toEqual([3])

        await vi.runOnlyPendingTimersAsync()
        expect(vals).toEqual([3, 2])

        await vi.runOnlyPendingTimersAsync()
        expect(vals).toEqual([3, 2, 1])
    })
})
