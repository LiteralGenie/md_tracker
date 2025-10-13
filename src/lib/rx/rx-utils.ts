import {
    BehaviorSubject,
    SubscribeReturn,
} from "@/lib/rx/behavior-subject"
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

type SwitchWhenReturn<T> = BehaviorSubject<
    | { first: false; value: T; sub: SubscribeReturn }
    | { first: true; value: null }
>

export function switchWhen<TSource, TTarget>(
    source: BehaviorSubject<TSource>,
    condition: (src: TSource) => boolean,
    mapping: (src: TSource) => BehaviorSubject<TTarget>
): [SwitchWhenReturn<TTarget>, SubscribeReturn["unsubscribe"]] {
    const subj$ = new BehaviorSubject({
        first: true,
        value: null,
    }) as SwitchWhenReturn<TTarget>

    let targetSub = null as SubscribeReturn | null
    const sourceSub = source.subscribe((x) => {
        if (condition(x)) {
            sourceSub.unsubscribe()

            const target$ = mapping(x)
            targetSub = target$.subscribe((value) => {
                subj$.set({
                    first: false,
                    value,
                    sub: targetSub!,
                })
            })
        }
    })

    let unsub: SubscribeReturn["unsubscribe"] = () => {
        sourceSub.unsubscribe()
        targetSub?.unsubscribe()
    }

    return [subj$, unsub]
}
