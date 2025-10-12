import { BS } from "@/lib/behavior-subject"
import { describe, expect, it } from "vitest"

describe("signal", () => {
    it("subscribe() should work", () => {
        const bs = BS(1)

        const vals = [] as number[]
        bs.subscribe((x) => {
            vals.push(x)
        })

        bs.value = 2
        bs.value = 3

        expect(vals).toEqual([1, 2, 3])
    })

    it("unsubscribe() should work", () => {
        const bs = BS(1)

        const id = Symbol()
        const vals = [] as number[]

        bs.subscribe((x) => vals.push(x), id)
        expect(vals).toEqual([1])

        bs.value = 2
        expect(vals).toEqual([1, 2])

        bs.unsubscribe(id)
        bs.value = 3
        expect(vals).toEqual([1, 2])

        bs.unsubscribe(id)
        bs.value = 4
        expect(vals).toEqual([1, 2])
    })

    it("unsub callback returned by subscribe() should work", () => {
        const bs = BS(1)

        const id = Symbol()
        const vals = [] as number[]

        const unsub = bs.subscribe((x) => vals.push(x), id)
        expect(vals).toEqual([1])

        bs.value = 2
        expect(vals).toEqual([1, 2])

        unsub()
        bs.value = 3
        expect(vals).toEqual([1, 2])

        unsub()
        bs.value = 4
        expect(vals).toEqual([1, 2])
    })

    it("pipe() should work", () => {
        const bs = BS(1)

        const id = Symbol()
        const vals = [] as number[]

        const unsub = bs.subscribe((x) => vals.push(x), id)
        expect(vals).toEqual([1])

        bs.value = 2
        expect(vals).toEqual([1, 2])

        unsub()
        bs.value = 3
        expect(vals).toEqual([1, 2])

        unsub()
        bs.value = 4
        expect(vals).toEqual([1, 2])
    })
})
