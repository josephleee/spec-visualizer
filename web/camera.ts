const EASE = 'cubic-bezier(.65, 0, .2, 1)'

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

// Board and document move as one camera: the stage card maps onto the viewport while the two layers cross over.
// Only transform and opacity are animated. Returns a stop function; `done` runs when the move finishes on its own.
export function zoom(cam: HTMLElement, board: HTMLElement, doc: HTMLElement, frame: Element | null, out: boolean, done: () => void): () => void {
  // The cards may still be landing (the intro) or lifting (hover): settle them first, or the card is measured where it is not going to be.
  board.getAnimations({ subtree: true }).forEach(a => a.finish())
  const v = cam.getBoundingClientRect(), r = (frame ?? cam).getBoundingClientRect()
  const s = v.width / r.width, x = r.left - v.left, y = r.top - v.top
  const opts: KeyframeAnimationOptions = { duration: 760, easing: EASE, fill: 'both', direction: out ? 'reverse' : 'normal' }
  cam.classList.add('moving')
  const anims = [
    board.animate([{ transform: 'translate(0px,0px) scale(1)', opacity: 1 }, { opacity: 1, offset: .3 }, { opacity: 0, offset: .8 },
      { transform: `translate(${-x * s}px,${-y * s}px) scale(${s})`, opacity: 0 }], opts),
    doc.animate([{ transform: `translate(${x}px,${y}px) scale(${1 / s})`, opacity: 0 }, { opacity: 0, offset: .25 }, { opacity: 1, offset: .8 },
      { transform: 'translate(0px,0px) scale(1)', opacity: 1 }], opts),
  ]
  Promise.all(anims.map(a => a.finished)).then(done, () => {})
  return () => { anims.forEach(a => a.cancel()); cam.classList.remove('moving') }
}

// Moving sideways to another stage: the new document slides in from the side it lies on.
export function slide(doc: HTMLElement, dir: number) {
  doc.animate([{ transform: `translateX(${dir * 7}%)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 340, easing: 'cubic-bezier(.2, .7, .2, 1)' })
}
