import { BehaviorSubject } from "@/lib/rx/behavior-subject"
import { enumerate } from "@/lib/utils/misc-utils"

export function fromMutationObserver<
    T extends (rs: MutationRecord[], obs: MutationObserver) => any
>(
    opts: MutationObserverInit & {
        target: Node
    },
    callback: T
): [BehaviorSubject<null | ReturnType<T>>, MutationObserver] {
    const mutation$ = new BehaviorSubject(null) as ReturnType<
        typeof fromMutationObserver
    >[0]

    const observer = new MutationObserver((mutations, observer) => {
        const result = callback(mutations, observer)
        mutation$.set(result)
    })
    observer.observe(opts.target, opts)

    return [mutation$, observer]
}

// prettier-ignore
type MergeAllReturn<TAll extends Array<BehaviorSubject<any>>> = 
    TAll extends []
        ? []

    : TAll extends [BehaviorSubject<infer T>]
        ? [T, { 
            source: Array<BehaviorSubject<any>>
         }]
    
    : TAll extends [BehaviorSubject<infer T>, ...infer TRest] ? TRest extends Array<BehaviorSubject<any>>
        ? [T, ...MergeAllReturn<TRest>]
        : never
    
    : never

type a = MergeAllReturn<[BehaviorSubject<1>, BehaviorSubject<2>]>

// @todo: fix sub leak
export function mergeAll<T extends Array<BehaviorSubject<any>>>(
    ...subjects: T
): BehaviorSubject<MergeAllReturn<T>> {
    const initValue = subjects.map((x) => x.value) as any

    const merged = new BehaviorSubject([
        ...initValue,
        { source: [...subjects] },
    ]) as any as BehaviorSubject<MergeAllReturn<T>>

    for (const [idx, subj] of enumerate(subjects)) {
        subj.subscribe((v) => {
            const update = [...merged.value] as MergeAllReturn<T>
            update[update.length - 1] = { source: [subj] }
            update[idx] = v
            merged.set(update)
        })
    }

    return merged
}
