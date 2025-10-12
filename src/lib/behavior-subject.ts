export type Subscriber<T> = (x: T) => void
export type ObsTransform<TIn, TOut> = (x: TIn) => TOut

export class BehaviorSubject<T> {
    sink: Map<any, Subscriber<T>> = new Map()
    source?: {
        subject: BehaviorSubject<any>
        sub: Subscriber<any>
    }

    constructor(public _value: T) {}

    get value() {
        return this._value
    }

    set value(value) {
        if (this._value === value) return
        this._value = value

        for (const subFn of this.sink.values()) {
            subFn(value)
        }
    }

    subscribe(handler: Subscriber<T>, id?: any) {
        const subFn = () => handler(this.value)

        id = id ?? Symbol()
        this.sink.set(id, subFn)

        subFn()

        const unsub = () => this.unsubscribe(id)
        unsub._unsub_id = id
        return unsub
    }

    unsubscribe(id: any) {
        return this.sink.delete(id)
    }

    toString() {
        return String(this._value)
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

        const newSubj = new BehaviorSubject<R>(allTfms(this._value))
        newSubj.source = {
            subject: this,
            sub: this.subscribe((x) => (newSubj.value = allTfms(x))),
        }
        return newSubj
    }
}
export const BS = <T>(x: T) => new BehaviorSubject(x)

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
