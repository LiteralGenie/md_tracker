import { sleep } from "radash"

export type Subscriber<T> = (x: T) => void
export type AsyncSubscriber<T> = (x: T) => Promise<void>
export type SubscribeReturn = {
    id: any
    unsubscribe: () => void
}
export type ObsTransform<TIn, TOut> = (x: TIn) => TOut

type SubId = any

export class BehaviorSubject<T> {
    name = ""

    sink: Map<SubId, Subscriber<T>> = new Map()

    _pending: Map<
        SubId,
        { resultId: Symbol; result: Promise<void> }
    > = new Map()

    source?: {
        subject: BehaviorSubject<any>
        sub: SubscribeReturn
    }

    constructor(public value: T) {}

    get(): T {
        return this.value
    }

    set(value: T) {
        this.value = value

        for (const subFn of this.sink.values()) {
            subFn(value)
        }
    }

    refresh() {
        this.set(this.value)
    }

    subscribe(handler: Subscriber<T>, id?: any): SubscribeReturn {
        id = id ?? Symbol()

        const subFn = (x: T) => handler(x)

        return this.postSubscribe(id, subFn)
    }

    /**
     * Same as subscribe() but accepts an async callback / handler
     * The handler is always invoked "in-order"
     *   eg if the value changes from 1 -> 2 -> 3
     *      the handler will be invoked similar to
     *      handler(1).then(() => handler(2)).then(() => handler(3))
     * @param handler
     * @param id
     * @returns
     */
    subscribeAsync(
        handler: AsyncSubscriber<T>,
        id?: any
    ): SubscribeReturn {
        id = id ?? Symbol()

        const notify = (x: T) => {
            // If the handler is busy, wait for it finish before calling with new value
            let result
            const prev = this._pending.get(id)
            if (!!prev) {
                result = prev.result.then(async () => {
                    await sleep(0)
                    handler(x)
                })
            } else {
                result = handler(x)
            }

            // Assign id to new value and mark it as latest
            const resultId = Symbol()
            this._pending.set(id, { resultId, result })

            // When the handler for new value is finally invoked
            // and if the new value is still the newest value,
            // delete the promise chain from pending to prevent leaks
            result.then(() => {
                const curr = this._pending.get(id)
                if (curr?.resultId === resultId) {
                    this._pending.delete(id)
                }
            })
        }

        return this.postSubscribe(id, notify)
    }

    private postSubscribe(
        id: any,
        notify: Subscriber<T> | AsyncSubscriber<T>
    ) {
        notify(this.value)

        this.sink.set(id, notify)

        return {
            id,
            unsubscribe: () => this.unsubscribe(id),
        }
    }

    unsubscribe(id: any) {
        return this.sink.delete(id)
    }

    pipe<TPipe extends PipeCandidate>(
        ...tfms: TPipe
    ): BehaviorSubject<PipeReturn<TPipe>> {
        type R = PipeReturn<TPipe>

        const allTfms = (x: T): R => {
            let result = x
            for (const t of tfms) {
                result = t(result)
            }
            return result as R
        }

        const newSubj = new BehaviorSubject<R>(allTfms(this.value))
        newSubj.source = {
            subject: this,
            sub: this.subscribe((x) => newSubj.set(allTfms(x))),
        }
        return newSubj
    }

    toString() {
        return this.name.length > 0 ? this.name : String(this.value)
    }
}

export type ExtractSubjectType<T$ extends BehaviorSubject<any>> =
    T$ extends BehaviorSubject<infer T> ? T : never

type PipeCandidate = Array<ObsTransform<any, any>>

// Returns true if pipe operations are valid
// (output type of one tfm matches input type of next tfm)
// prettier-ignore
type IsPipeValid<TInit, TCandidate extends PipeCandidate> =
    // Empty
    TCandidate extends []
        ? "error: empty"
    
    // Single item
    : TCandidate extends [ObsTransform<TInit, any>]
        ? true

    // Single item, invalid
    : TCandidate extends [ObsTransform<any, any>]
        ? 'error: invalid, single'
    
    // Multiple items
    : TCandidate extends [ObsTransform<TInit, infer TOut>, ...infer TRest]
        ? TRest extends PipeCandidate
            ? IsPipeValid<TOut, TRest>
            : 'impossible (multiple)'

    // Multiple items, invalid
    : TCandidate extends [ObsTransform<any, any>, ...infer TRest]
        ? 'error: invalid, single'
    
    : "impossible"

// Returns input if valid
// otherwise, returns error message
// prettier-ignore
type ValidatePipe<TInit, TCandidate extends PipeCandidate> =
    IsPipeValid<TInit, TCandidate> extends true ? TCandidate : never

// Extract final output type of pipe
type PipeReturn<TCandidate extends PipeCandidate> = IsPipeValid<
    any,
    TCandidate
> extends true
    ? // Empty
      TCandidate extends []
        ? "error: empty pipe"
        : // Single item
        TCandidate extends [ObsTransform<any, infer TOut>]
        ? TOut
        : // Multiple items
        TCandidate extends [ObsTransform<any, any>, ...infer TRest]
        ? TRest extends PipeCandidate
            ? PipeReturn<TRest>
            : "impossible"
        : "impossible"
    : "error: invalid pipe"
